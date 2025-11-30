#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use sysinfo::{PidExt, ProcessExt, ProcessStatus, System, SystemExt};

// ----- Estructura que serializamos al frontend -----
#[derive(Serialize)]
pub struct Proceso {
    pub pid: String,
    pub nombre: String,
    pub prioridad: i32,
    pub tiempo_cpu: f64,
    pub memoria: u64,
    pub estado: String,
    pub interactividad: i32,
    pub avance: f64,
    pub iteraciones: u32,
    pub tiempo_total: f64,
    pub tiempo_restante: f64,
}

// ----- Estado en memoria para el muestreo entre invocaciones -----
struct ProcStat {
    last_seen: Instant,
    acc_cpu_seconds: f64,
    iteraciones: u32,
    last_cpu_positive: bool,
    ewma_cpu: f64,
}

static PROC_STATE: Lazy<Mutex<HashMap<u32, ProcStat>>> = Lazy::new(|| Mutex::new(HashMap::new()));

const CPU_THRESHOLD: f64 = 1.0;
const EWMA_ALPHA: f64 = 0.25;

#[tauri::command]
fn obtener_procesos() -> Result<Vec<Proceso>, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();
    sys.refresh_cpu();
    sys.refresh_memory();

    let now = Instant::now();

    let mut out: Vec<Proceso> = sys
        .processes()
        .iter()
        .map(|(pid, process)| {
            let estado = match process.status() {
                ProcessStatus::Run => "ejecutando",
                ProcessStatus::Sleep => "dormido",
                ProcessStatus::Idle => "inactivo",
                ProcessStatus::Stop => "detenido",
                ProcessStatus::Zombie => "zombie",
                ProcessStatus::Tracing => "trazando",
                ProcessStatus::Unknown(_) => "desconocido",
                _ => "desconocido",
            }
            .to_string();

            let prioridad = 1;
            let cpu = process.cpu_usage() as f64;
            let mem_kb = process.memory();

            // Heurística para tiempo_total: mapear CPU 0-100 -> 1-20 segundos
            let tiempo_total = if cpu > 0.0 {
                let v = ((cpu / 100.0) * 19.0) + 1.0;
                v.round().clamp(1.0, 20.0)
            } else {
                let mem_mb = (mem_kb as f64) / 1024.0;
                ((mem_mb / 50.0) + 10.0).round().max(5.0)
            };

            let mut tiempo_restante = tiempo_total;
            let pid_u32 = pid.as_u32();

            {
                let mut map = PROC_STATE.lock().expect("failed to lock PROC_STATE mutex");

                if let Some(stat) = map.get_mut(&pid_u32) {
                    let elapsed = now.duration_since(stat.last_seen).as_secs_f64();
                    let added_cpu_seconds = (cpu / 100.0) * elapsed;
                    stat.acc_cpu_seconds += added_cpu_seconds;

                    // Actualizar EWMA del uso de CPU
                    stat.ewma_cpu = EWMA_ALPHA * cpu + (1.0 - EWMA_ALPHA) * stat.ewma_cpu;

                    // Detectar transición a consumir CPU
                    let now_positive = cpu > CPU_THRESHOLD;
                    if now_positive && !stat.last_cpu_positive {
                        stat.iteraciones = stat.iteraciones.saturating_add(1);
                    }
                    stat.last_cpu_positive = now_positive;
                    stat.last_seen = now;

                    if tiempo_total > 0.0 {
                        let raw_pct = (stat.acc_cpu_seconds / tiempo_total) * 100.0;
                        let avance = raw_pct.clamp(0.0, 100.0);

                        tiempo_restante = if stat.acc_cpu_seconds >= tiempo_total {
                            0.0
                        } else {
                            (tiempo_total - stat.acc_cpu_seconds).max(0.0)
                        };

                        let interactividad = 1;

                        return Proceso {
                            pid: pid_u32.to_string(),
                            nombre: process.name().to_string(),
                            prioridad,
                            tiempo_cpu: cpu,
                            memoria: mem_kb,
                            estado,
                            interactividad,
                            avance,
                            iteraciones: stat.iteraciones,
                            tiempo_total,
                            tiempo_restante,
                        };
                    } else {
                        let interactividad = 1;
                        return Proceso {
                            pid: pid_u32.to_string(),
                            nombre: process.name().to_string(),
                            prioridad,
                            tiempo_cpu: cpu,
                            memoria: mem_kb,
                            estado,
                            interactividad,
                            avance: 0.0,
                            iteraciones: stat.iteraciones,
                            tiempo_total,
                            tiempo_restante,
                        };
                    }
                } else {
                    let initial_iter = if cpu > CPU_THRESHOLD { 1 } else { 0 };
                    let stat = ProcStat {
                        last_seen: now,
                        acc_cpu_seconds: 0.0,
                        iteraciones: initial_iter,
                        last_cpu_positive: cpu > CPU_THRESHOLD,
                        ewma_cpu: cpu,
                    };
                    map.insert(pid_u32, stat);

                    let interactividad = 1;
                    return Proceso {
                        pid: pid_u32.to_string(),
                        nombre: process.name().to_string(),
                        prioridad,
                        tiempo_cpu: cpu,
                        memoria: mem_kb,
                        estado,
                        interactividad,
                        avance: 0.0,
                        iteraciones: initial_iter,
                        tiempo_total,
                        tiempo_restante,
                    };
                }
            }
        })
        .collect();

    // Limpieza de procesos eliminados
    {
        let current_pids: std::collections::HashSet<u32> =
            sys.processes().keys().map(|pid| pid.as_u32()).collect();
        let mut map = PROC_STATE
            .lock()
            .expect("failed to lock PROC_STATE mutex for cleanup");
        let stale: Vec<u32> = map
            .keys()
            .cloned()
            .filter(|k| !current_pids.contains(k))
            .collect();
        for k in stale {
            map.remove(&k);
        }
    }

    out.sort_by(|a, b| {
        b.tiempo_cpu
            .partial_cmp(&a.tiempo_cpu)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(out)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![obtener_procesos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
