import React, { useMemo, useRef, useState } from "react";
import "./home.css";
import { BrowserMultiFormatReader } from "@zxing/browser";

// Mock simple para probar lectura / tipeo de códigos
const PRODUCT_DB = {
  "7791234567890": { descripcion: "Coca Cola 500ml", precio: 1500 },
  "7790000000001": { descripcion: "Galletitas", precio: 900 },
  "7790000000002": { descripcion: "Yerba 1kg", precio: 3200 },
};

export default function Home() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]);

  // ---- Debug ----
  const [debugLines, setDebugLines] = useState([]);
  const log = (msg) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setDebugLines((prev) => [line, ...prev].slice(0, 30));
  };

  // ---- Scanner modal ----
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerVideoRef = useRef(null);
  const readerRef = useRef(null);
  const isScanningRef = useRef(false);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.subtotal, 0),
    [items]
  );

  // ---- lógica POS básica ----
  const addByBarcode = (code) => {
    const clean = String(code || "").trim();
    if (!clean) return;

    log(`📦 Código detectado: ${clean}`);
    setBarcode(clean); // por si querés verlo en el input

    const prod = PRODUCT_DB[clean];
    if (!prod) {
      // por ahora lo dejamos explícito, para que sepas que escaneó pero no existe en DB
      alert(`Escaneado OK, pero no existe en mock DB: ${clean}`);
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
  };

  const clearAll = () => {
    setItems([]);
    setBarcode("");
  };

  // ---- scanner start/stop ----
  const stopScanner = () => {
    try {
      isScanningRef.current = false;
      if (readerRef.current) {
        readerRef.current.reset();
        readerRef.current = null;
      }
      if (scannerVideoRef.current) {
        scannerVideoRef.current.pause?.();
        scannerVideoRef.current.srcObject = null;
      }
      log("🛑 Scanner detenido");
    } catch {
      // noop
    }
  };

  const closeScanner = () => {
    stopScanner();
    setScannerOpen(false);
    setScannerError("");
  };

  const openScanner = async () => {
    setScannerError("");
    setScannerOpen(true);

    // Esperamos a que el modal renderice el <video>
    setTimeout(async () => {
      try {
        const video = scannerVideoRef.current;
        if (!video) {
          setScannerError("No se pudo inicializar el video del scanner.");
          log("❌ scannerVideoRef.current = null");
          return;
        }

        // Crear lector
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        isScanningRef.current = true;

        log("📷 Iniciando scanner (ZXing)…");

        // Pedimos cámara trasera ideal
        await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          video,
          (result, err) => {
            if (!isScanningRef.current) return;

            if (result) {
              const text = result.getText();
              log(`✅ Detectado: ${text}`);

              // feedback opcional
              if (navigator.vibrate) navigator.vibrate(80);

              // agregar al carrito
              addByBarcode(text);

              // cerrar scanner
              closeScanner();
            }
          }
        );

        log("✅ Scanner corriendo");
      } catch (e) {
        stopScanner();
        const msg =
          e?.name === "NotAllowedError"
            ? "Permiso denegado. Habilitá la cámara."
            : e?.name === "NotFoundError"
            ? "No se encontró cámara."
            : e?.name === "NotReadableError"
            ? "La cámara está ocupada por otra app."
            : e?.name === "OverconstrainedError"
            ? "El dispositivo no soporta los constraints solicitados."
            : `Error al iniciar scanner: ${e?.name || "desconocido"}`;

        setScannerError(msg);
        log(`❌ ${msg}`);
      }
    }, 50);
  };

  return (
    <div className="home-wrap">
      <header className="home-header">
        <div>
          <h1>POS Mobile</h1>
          <p>Escaneo con cámara + listado + total</p>
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

        <button className="btn btn-secondary" onClick={openScanner}>
          Escanear
        </button>
      </section>

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
              <div className="right">${it.precio.toLocaleString("es-AR")}</div>
              <div className="right">{it.cantidad}</div>
              <div className="right">${it.subtotal.toLocaleString("es-AR")}</div>
            </div>
          ))
        )}
      </section>

      <footer className="total-bar">
        <span>Total</span>
        <strong>${total.toLocaleString("es-AR")}</strong>
      </footer>

      {/* MODAL SCANNER */}
      {scannerOpen && (
        <div className="scan-modal-overlay" onClick={closeScanner}>
          <div className="scan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="scan-modal-head">
              <h2>Escanear código</h2>
              <button className="btn btn-danger" onClick={closeScanner}>
                Cerrar
              </button>
            </div>

            {scannerError ? (
              <div className="scan-error">{scannerError}</div>
            ) : (
              <video
                ref={scannerVideoRef}
                className="scan-video"
                playsInline
                muted
                autoPlay
              />
            )}

            <div className="scan-hint">
              Apuntá al código de barras. Al detectarlo, se agrega automáticamente.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
