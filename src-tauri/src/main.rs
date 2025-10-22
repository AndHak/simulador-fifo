// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use sysinfo::{ProcessExt, System, SystemExt, PidExt, ProcessStatus};

#[derive(Serialize)]
pub struct Proceso {
  pub pid: String,            // lo serializamos como string para evitar issues TS
  pub nombre: String,
  pub prioridad: i32,         // heurístico (no siempre disponible)
  pub tiempo_cpu: f64,        // porcentaje aproximado
  pub memoria: u64,           // en KB (sysinfo)
  pub estado: String,
  pub avance: f64,            // placeholder (no lo sabemos, 0)
  pub iteraciones: u32,       // placeholder (0)
}

#[tauri::command]
fn obtener_procesos() -> Result<Vec<Proceso>, String> {
  // Crea el sistema, refresca procesos
  let mut sys = System::new_all();
  sys.refresh_processes();
  sys.refresh_cpu(); // actualizar uso cpu
  sys.refresh_memory();

  let mut out: Vec<Proceso> = sys.processes().iter().map(|(pid, process)| {
    // estado -> string
    let estado = match process.status() {
      ProcessStatus::Run => "ejecutando",
      ProcessStatus::Sleep => "dormido",
      ProcessStatus::Idle => "inactivo",
      ProcessStatus::Stop => "detenido",
      ProcessStatus::Zombie => "zombie",
      ProcessStatus::Tracing => "trazando",
      ProcessStatus::Unknown(_) => "desconocido",
      _ => "desconocido",
    }.to_string();

    // prioridad heurística: sysinfo no expone priority cross-platform; asi que queda 1 por defecto
    let prioridad = 1;

    Proceso {
      pid: pid.as_u32().to_string(),
      nombre: process.name().to_string(),
      prioridad,
      tiempo_cpu: process.cpu_usage() as f64, // valor aproximado
      memoria: process.memory(),              // en KB
      estado,
      avance: 0.0,
      iteraciones: 0,
    }
  }).collect();

  // ordenar por CPU descendente
  out.sort_by(|a, b| b.tiempo_cpu.partial_cmp(&a.tiempo_cpu).unwrap_or(std::cmp::Ordering::Equal));

  Ok(out)
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![obtener_procesos])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
