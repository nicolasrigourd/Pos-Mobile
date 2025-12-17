import React, { useMemo, useRef, useState } from "react";
import "./home.css";

// Mock simple para probar lectura / tipeo de códigos
const PRODUCT_DB = {
  "7791234567890": { descripcion: "Coca Cola 500ml", precio: 1500 },
  "7790000000001": { descripcion: "Galletitas", precio: 900 },
  "7790000000002": { descripcion: "Yerba 1kg", precio: 3200 },
};

export default function Home() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]);

  // --- Test cámara/permisos ---
  const [camOpen, setCamOpen] = useState(false);
  const [camError, setCamError] = useState("");
  const [camInfo, setCamInfo] = useState(""); // settings + info útil
  const [debugLines, setDebugLines] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const log = (msg) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setDebugLines((prev) => [line, ...prev].slice(0, 30));
  };

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.subtotal, 0),
    [items]
  );

  const addByBarcode = (code) => {
    const clean = String(code || "").trim();
    if (!clean) return;

    const prod = PRODUCT_DB[clean];
    if (!prod) {
      alert(`No encontrado: ${clean} (mock DB por ahora)`);
      setBarcode("");
      return;
    }

    setItems((prev) => {
      const idx = prev.findIndex((p) => p.codigo === clean);
      if (idx >= 0) {
        const copy = [...prev];
        const item = copy[idx];
        const nuevaCantidad = item.cantidad + 1;

        copy[idx] = {
          ...item,
          cantidad: nuevaCantidad,
          subtotal: nuevaCantidad * item.precio,
        };
        return copy;
      }

      return [
        ...prev,
        {
          codigo: clean,
          descripcion: prod.descripcion,
          precio: prod.precio,
          cantidad: 1,
          subtotal: prod.precio,
        },
      ];
    });

    setBarcode("");
  };

  const removeItem = (codigo) => {
    setItems((prev) => prev.filter((p) => p.codigo !== codigo));
  };

  const clearAll = () => {
    setItems([]);
    setBarcode("");
  };

  const closeCameraTest = () => {
    log("Cerrando cámara…");
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const v = videoRef.current;
    if (v) {
      v.pause?.();
      v.srcObject = null;
    }

    setCamOpen(false);
    setCamInfo("");
    setCamError("");
  };

  const openCameraTest = async () => {
    setCamError("");
    setCamInfo("");

    log("Click Test Cámara");

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setCamError("Este navegador NO expone getUserMedia (bloqueado o no soportado).");
      log("❌ navigator.mediaDevices.getUserMedia NO disponible");
      return;
    }

    // si había una previa, cortar primero
    closeCameraTest();

    const startStream = async (constraints, label) => {
      log(`Solicitando getUserMedia: ${label}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const tracks = stream.getVideoTracks();
      log(`Tracks video: ${tracks.length}`);

      const settings = tracks[0]?.getSettings?.() || {};
      setCamInfo(JSON.stringify(settings, null, 2));
      log(`Settings: ${JSON.stringify(settings)}`);

      const video = videoRef.current;
      if (!video) {
        log("❌ videoRef.current es null (no está montado el <video>)");
        return;
      }

      video.srcObject = stream;

      // forzar atributos (especialmente iOS)
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");

      // intento de play
      log("Intentando video.play()…");
      await video.play();

      setCamOpen(true);
      log("✅ Cámara abierta y reproduciendo");
    };

    try {
      // 1) intento trasera
      await startStream(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        "trasera (facingMode environment)"
      );
    } catch (e1) {
      log(`⚠️ Falló trasera: ${e1?.name || "error"} ${e1?.message || ""}`);

      try {
        // 2) fallback: cualquier cámara
        await startStream({ audio: false, video: true }, "fallback video:true");
      } catch (e2) {
        const msg =
          e2?.name === "NotAllowedError"
            ? "Permiso denegado. Revisá permisos del navegador."
            : e2?.name === "NotFoundError"
            ? "No se encontró cámara."
            : e2?.name === "NotReadableError"
            ? "La cámara está ocupada por otra app."
            : e2?.name === "OverconstrainedError"
            ? "Constraints no soportados por el dispositivo."
            : `Error al abrir cámara: ${e2?.name || "desconocido"} ${e2?.message || ""}`;

        setCamError(msg);
        log(`❌ Error final: ${msg}`);
        setCamOpen(false);
      }
    }
  };

  return (
    <div className="home-wrap">
      <header className="home-header">
        <div>
          <h1>POS Mobile</h1>
          <p>Home básica: input + listado + total + test cámara + debug</p>
        </div>

        <button className="btn btn-ghost" onClick={clearAll}>
          Limpiar
        </button>
      </header>

      <section className="scan-row">
        <input
          className="barcode-input"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Escaneá o escribí el código…"
          inputMode="numeric"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") addByBarcode(barcode);
          }}
        />

        <button className="btn" onClick={() => addByBarcode(barcode)}>
          Agregar
        </button>

        {!camOpen ? (
          <button className="btn btn-secondary" onClick={openCameraTest}>
            Test Cámara
          </button>
        ) : (
          <button className="btn btn-danger" onClick={closeCameraTest}>
            Cerrar Cámara
          </button>
        )}
      </section>

      {/* Errores + info */}
      {camError && <div className="cam-error">{camError}</div>}

      {camOpen && (
        <div className="cam-preview">
          <div className="cam-title">Preview cámara</div>
          <video ref={videoRef} className="cam-video" playsInline muted autoPlay />
          <div className="cam-hint">
            Si se ve negro, mirá el Debug abajo (settings/error/flow).
          </div>

          {camInfo && (
            <pre className="cam-info">
              {camInfo}
            </pre>
          )}
        </div>
      )}

      {/* DEBUG PANEL */}
      <section className="debug-box">
        <div className="debug-head">
          <strong>Debug</strong>
          <button className="btn btn-ghost" onClick={() => setDebugLines([])}>
            Limpiar log
          </button>
        </div>
        {debugLines.length === 0 ? (
          <div className="debug-empty">Sin eventos todavía.</div>
        ) : (
          <div className="debug-lines">
            {debugLines.map((l, i) => (
              <div className="debug-line" key={i}>
                {l}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="products-box">
        <div className="products-head">
          <div>Producto</div>
          <div className="right">Precio</div>
          <div className="right">Cant.</div>
          <div className="right">Subtotal</div>
          <div className="right">Acción</div>
        </div>

        {items.length === 0 ? (
          <div className="empty">Todavía no hay productos cargados.</div>
        ) : (
          items.map((it) => (
            <div className="product-row" key={it.codigo}>
              <div className="desc">
                <div className="desc-title">{it.descripcion}</div>
                <div className="desc-code">Cod: {it.codigo}</div>
              </div>

              <div className="right">${it.precio.toLocaleString("es-AR")}</div>
              <div className="right">{it.cantidad}</div>
              <div className="right">${it.subtotal.toLocaleString("es-AR")}</div>

              <div className="right">
                <button className="btn btn-danger" onClick={() => removeItem(it.codigo)}>
                  Quitar
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <footer className="total-bar">
        <span>Total</span>
        <strong>${total.toLocaleString("es-AR")}</strong>
      </footer>
    </div>
  );
}
