// Imports principales
use serde::Serialize; // para serializar la struct Proceso a JSON
use sysinfo::{ProcessExt, System, SystemExt, PidExt, ProcessStatus}; // sysinfo para leer procesos
use once_cell::sync::Lazy; // para inicializar estáticos de forma lazy
use std::collections::HashMap; // mapa para estado por pid
use std::sync::Mutex; // Mutex para sincronizar acceso al estado global
use std::time::Instant; // marca de tiempo de alta resolución

// ----- Estructura que serializamos al frontend -----
// Incluye los campos antiguos y los nuevos campos de tiempo + progreso + interactividad
#[derive(Serialize)]
pub struct Proceso {
  pub pid: String,           // pid serializado como string para evitar problemas en TS
  pub nombre: String,        // nombre del proceso
  pub prioridad: i32,        // heurístico de prioridad (fijo por ahora)
  pub tiempo_cpu: f64,       // uso de CPU % actual (aprox)
  pub memoria: u64,          // memoria en KB
  pub estado: String,        // estado textual (ej. "ejecutando")
  pub interactividad: String,// NUEVO: etiqueta ("tiempo real" | "alta" | "media" | "baja")
  pub avance: f64,           // NUEVO: avance estimado (0..100)
  pub iteraciones: u32,      // NUEVO: contador de "iteraciones" (veces que recibió CPU)
  // Campos para que frontend no tenga que inferir tiempos
  pub tiempo_total: f64,     // estimación heurística del "tiempo total" (segundos estimados)
  pub tiempo_restante: f64,  // estimación heurística del "tiempo restante" (segundos estimados)
}

// ----- Estado en memoria para el muestreo entre invocaciones -----
// Guardamos para cada PID:
//  - last_seen: Instant de la última muestra
//  - acc_cpu_seconds: acumulado aproximado de segundos de CPU consumidos
//  - iteraciones: contador de transiciones a estado activo
//  - last_cpu_positive: flag si en la última muestra estaba consumiendo CPU (> umbral)
//  - ewma_cpu: media móvil exponencial del uso de CPU (0..100) para inferir interactividad
struct ProcStat {
  last_seen: Instant,
  acc_cpu_seconds: f64,
  iteraciones: u32,
  last_cpu_positive: bool,
  ewma_cpu: f64,
}

// Mapa global compartido: PID_u32 -> ProcStat
// Lazy + Mutex para acceso seguro entre llamadas
static PROC_STATE: Lazy<Mutex<HashMap<u32, ProcStat>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Umbral para considerar que un proceso "está usando CPU" (1% por ejemplo)
const CPU_THRESHOLD: f64 = 1.0; // porcentaje

// Parámetro EWMA (0..1). Más alto = más reactivo, más bajo = más suave.
const EWMA_ALPHA: f64 = 0.25;

// ----- Helper: mapear ewma_cpu a etiqueta de interactividad -----
// Ajusta los cortes (70/25/10/5) si quieres otros umbrales.
fn label_interactividad_from_ewma(ewma: f64) -> &'static str {
  if ewma >= 70.0 {
    "tiempo real"
  } else if ewma >= 25.0 {
    "alta"
  } else if ewma >= 10.0 {
    "media"
  } else if ewma >= 5.0 {
    "baja"
  } else {
    "muy baja"
  }
}

// ----- Comando expuesto a Tauri -----
#[tauri::command]
fn obtener_procesos() -> Result<Vec<Proceso>, String> {
  // 1) inicializar/actualizar sistema
  let mut sys = System::new_all();
  sys.refresh_processes(); // refrescar lista de procesos
  sys.refresh_cpu();       // refrescar uso de CPU
  sys.refresh_memory();    // refrescar memoria

  // 2) obtener tiempo actual para cálculos de delta
  let now = Instant::now();

  // 3) Crear vector de procesos a partir del snapshot de sysinfo
  let mut out: Vec<Proceso> = sys.processes().iter().map(|(pid, process)| {
    // 3.1) mapear el estado a una cadena legible
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

    // 3.2) prioridad heurística (no expuesto cross-platform por sysinfo)
    let prioridad = 1;

    // 3.3) valores crudos actuales del proceso
    let cpu = process.cpu_usage() as f64; // uso CPU % (ej. 0..100)
    let mem_kb = process.memory(); // memoria en KB

    // 3.4) HEURÍSTICA para tiempo_total:
    //      Queremos que tiempo_total derivado de CPU quede entre 1 y 20 (máx).
    //      Para ello mapeamos linealmente cpu% (0..100) -> rango 1..20:
    //        tiempo_total = round((cpu/100)*19 + 1)
    //      Si cpu == 0 usamos fallback por memoria (como antes).
    let tiempo_total = if cpu > 0.0 {
      // mapear cpu 0..100 -> 1..20
      let v = ((cpu / 100.0) * 19.0) + 1.0;
      v.round().clamp(1.0, 20.0) // redondear y asegurar 1..20 por si acaso
    } else {
      let mem_mb = (mem_kb as f64) / 1024.0;
      ((mem_mb / 50.0) + 10.0).round().max(5.0) // fallback basado en memoria
    };

    // 3.5) por defecto dejamos tiempo_restante igual a tiempo_total (sin historial)
    let mut tiempo_restante = tiempo_total;

    // --- Ahora consultamos y actualizamos el estado acumulado en PROC_STATE ---
    // Convertir pid a u32 para indexar el HashMap
    let pid_u32 = pid.as_u32();

    // Bloque de sincronización para acceder/actualizar PROC_STATE
    {
      // obtener el mutex guard (lock)
      let mut map = PROC_STATE.lock().expect("failed to lock PROC_STATE mutex");

      // comprobar si ya tenemos un registro previo para este PID
      if let Some(stat) = map.get_mut(&pid_u32) {
        // calcular tiempo transcurrido desde la última muestra en segundos
        let elapsed = now.duration_since(stat.last_seen).as_secs_f64();

        // acumular "segundos de CPU" aproximados: uso%/100 * elapsed_seconds
        // ejemplo: si cpu = 50% y elapsed = 2s -> sumamos 1.0s de CPU
        let added_cpu_seconds = (cpu / 100.0) * elapsed;
        stat.acc_cpu_seconds += added_cpu_seconds;

        // --- actualizar EWMA del uso de CPU ---
        // stat.ewma_cpu <- alpha * cpu + (1-alpha) * stat.ewma_cpu
        stat.ewma_cpu = EWMA_ALPHA * cpu + (1.0 - EWMA_ALPHA) * stat.ewma_cpu;

        // detectar transición a consumir CPU: si ahora cpu > threshold y antes no
        let now_positive = cpu > CPU_THRESHOLD;
        if now_positive && !stat.last_cpu_positive {
          // contar una nueva "iteración" cuando el proceso vuelve a recibir CPU
          stat.iteraciones = stat.iteraciones.saturating_add(1);
        }
        // actualizar flag y timestamp
        stat.last_cpu_positive = now_positive;
        stat.last_seen = now;

        // usar los valores del stat para calcular avance/iteraciones
        // evitar dividir por cero: si tiempo_total > 0 usamos la estimación
        if tiempo_total > 0.0 {
          // avance = acc_cpu_seconds / tiempo_total * 100 (clamp 0..100)
          let raw_pct = (stat.acc_cpu_seconds / tiempo_total) * 100.0;
          let avance = raw_pct.clamp(0.0, 100.0);
          // actualizar tiempo_restante como diferencia (en segundos)
          // si acc_cpu_seconds > tiempo_total se marca en 0
          tiempo_restante = if stat.acc_cpu_seconds >= tiempo_total {
            0.0
          } else {
            // resto en segundos estimados
            (tiempo_total - stat.acc_cpu_seconds).max(0.0)
          };

          // determinar interactividad a partir de ewma_cpu (suavizado)
          let interactividad = label_interactividad_from_ewma(stat.ewma_cpu).to_string();

          // construir Proceso con avance e iteraciones actualizadas
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
          // si no hay tiempo_total válido, devolver avance=0 y stat.iteraciones
          let interactividad = label_interactividad_from_ewma(stat.ewma_cpu).to_string();
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
        // No hay registro previo: crear uno inicial
        let initial_iter = if cpu > CPU_THRESHOLD { 1 } else { 0 };
        let stat = ProcStat {
          last_seen: now,
          acc_cpu_seconds: 0.0, // empezamos sin acumulado histórico
          iteraciones: initial_iter,
          last_cpu_positive: cpu > CPU_THRESHOLD,
          ewma_cpu: cpu, // inicializar EWMA con el valor actual
        };
        map.insert(pid_u32, stat);
        // Con registro nuevo, progreso 0 (sin historial suficiente)
        let interactividad = label_interactividad_from_ewma(cpu).to_string();
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
    } // fin del scope del lock (map queda desbloqueado aquí)
  }).collect(); // collect del iterator a Vec<Proceso>

  // ----- LIMPIEZA: eliminar entradas en PROC_STATE que ya no existen en el snapshot -----
  // Construir un HashSet de PIDs actuales para detectar procesos eliminados
  {
    let current_pids: std::collections::HashSet<u32> = sys.processes().keys().map(|pid| pid.as_u32()).collect();
    let mut map = PROC_STATE.lock().expect("failed to lock PROC_STATE mutex for cleanup");
    // recolectar keys que no están en current_pids
    let stale: Vec<u32> = map.keys().cloned().filter(|k| !current_pids.contains(k)).collect();
    // remover entradas stale
    for k in stale {
      map.remove(&k);
    }
  }

  // ordenar por CPU descendente para mostrar los procesos más activos arriba
  out.sort_by(|a, b| b.tiempo_cpu.partial_cmp(&a.tiempo_cpu).unwrap_or(std::cmp::Ordering::Equal));

  // devolver vector serializable al frontend
  Ok(out)
}

// ----- main: iniciar Tauri con el comando expuesto -----
// (sin cambios respecto a tu main original)
fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![obtener_procesos])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
