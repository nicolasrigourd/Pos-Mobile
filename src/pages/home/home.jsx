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

  // ---- cámara / permisos ----
  const [camOpen, setCamOpen] = useState(false);
  const [camError, setCamError] = useState("");
  const [camInfo, setCamInfo] = useState("");
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

  // ---- lógica POS básica ----
  const addByBarcode = (code) => {
    const clean = String(code || "").trim();
    if (!clean) return;

    const prod = PRODUCT_DB[clean];
    if (!prod) {
      alert(`No encontrado: ${clean} (mock DB)`);
      setBarcode("");
      return;
    }

    setItems((prev) => {
      const idx = prev.findIndex((p) => p.codigo === clean);
      if (idx >= 0) {
        const copy = [...prev];
        const item = copy[idx];
        const cant = item.cantidad + 1;
        copy[idx] = { ...item, cantidad: cant, subtotal: cant * item.precio };
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

  const clearAll = () => {
    setItems([]);
    setBarcode("");
  };

  // ---- cámara ----
  const closeCamera = () => {
    log("Cerrando cámara");
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCamOpen(false);
  };

  const openCamera = async () => {
    setCamError("");
    setCamInfo("");
    log("Click Test Cámara");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("getUserMedia NO disponible");
      log("❌ getUserMedia no existe");
      return;
    }

    closeCamera();

    const start = async (constraints, label) => {
      log(`getUserMedia → ${label}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      setCamInfo(JSON.stringify(settings, null, 2));
      log(`settings: ${JSON.stringify(settings)}`);

      const video = videoRef.current;
      if (!video) {
        log("❌ videoRef sigue null (esto ya no debería pasar)");
        return;
      }

      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");

      await video.play();
      setCamOpen(true);
      log("✅ cámara reproduciendo");
    };

    try {
      await start(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        "trasera"
      );
    } catch (e1) {
      log(`⚠️ trasera falló: ${e1.name}`);
      try {
        await start({ video: true, audio: false }, "fallback");
      } catch (e2) {
        const msg =
          e2.name === "NotAllowedError"
            ? "Permiso de cámara denegado"
            : e2.name === "NotReadableError"
            ? "Cámara ocupada por otra app"
            : e2.name === "NotFoundError"
            ? "No hay cámara"
            : `Error cámara: ${e2.name}`;

        setCamError(msg);
        log(`❌ ${msg}`);
      }
    }
  };

  return (
    <div className="home-wrap">
      <header className="home-header">
        <div>
          <h1>POS Mobile</h1>
          <p>Home + test de cámara + debug</p>
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
          onKeyDown={(e) => e.key === "Enter" && addByBarcode(barcode)}
        />

        <button className="btn" onClick={() => addByBarcode(barcode)}>
          Agregar
        </button>

        {!camOpen ? (
          <button className="btn btn-secondary" onClick={openCamera}>
            Test Cámara
          </button>
        ) : (
          <button className="btn btn-danger" onClick={closeCamera}>
            Cerrar Cámara
          </button>
        )}
      </section>

      {camError && <div className="cam-error">{camError}</div>}

      {/* VIDEO SIEMPRE MONTADO */}
      <div className="cam-preview" style={{ display: camOpen ? "block" : "none" }}>
        <div className="cam-title">Preview cámara</div>
        <video
          ref={videoRef}
          className="cam-video"
          playsInline
          muted
          autoPlay
        />
        {camInfo && <pre className="cam-info">{camInfo}</pre>}
      </div>

      {/* DEBUG */}
      <section className="debug-box">
        <div className="debug-head">
          <strong>Debug</strong>
          <button className="btn btn-ghost" onClick={() => setDebugLines([])}>
            Limpiar
          </button>
        </div>
        {debugLines.map((l, i) => (
          <div key={i} className="debug-line">
            {l}
          </div>
        ))}
      </section>

      {/* LISTADO */}
      <section className="products-box">
        <div className="products-head">
          <div>Producto</div>
          <div className="right">Precio</div>
          <div className="right">Cant.</div>
          <div className="right">Subtotal</div>
        </div>

        {items.length === 0 ? (
          <div className="empty">Sin productos</div>
        ) : (
          items.map((it) => (
            <div className="product-row" key={it.codigo}>
              <div>
                <strong>{it.descripcion}</strong>
                <div className="desc-code">Cod: {it.codigo}</div>
              </div>
              <div className="right">${it.precio}</div>
              <div className="right">{it.cantidad}</div>
              <div className="right">${it.subtotal}</div>
            </div>
          ))
        )}
      </section>

      <footer className="total-bar">
        <span>Total</span>
        <strong>${total}</strong>
      </footer>
    </div>
  );
}
