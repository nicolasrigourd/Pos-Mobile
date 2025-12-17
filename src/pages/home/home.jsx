import React, { useMemo, useRef, useState } from "react";
import "./home.css";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

// Mock simple para probar lectura / tipeo de códigos
const PRODUCT_DB = {
  "7791234567890": { descripcion: "Coca Cola 500ml", precio: 1500 },
  "7790000000001": { descripcion: "Galletitas", precio: 900 },
  "7790000000002": { descripcion: "Yerba 1kg", precio: 3200 },
};

// Hints para acelerar (solo formatos típicos de POS)
const ZXING_HINTS = new Map();
ZXING_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.CODE_128,
]);
// No “try harder” = más rápido
ZXING_HINTS.set(DecodeHintType.TRY_HARDER, false);

export default function Home() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]);

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

  const addByBarcode = (code) => {
    const clean = String(code || "").trim();
    if (!clean) return;

    setBarcode(clean);

    const prod = PRODUCT_DB[clean];
    if (!prod) {
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

  const stopScanner = () => {
    try {
      isScanningRef.current = false;

      if (readerRef.current) {
        readerRef.current.reset();
        readerRef.current = null;
      }

      const video = scannerVideoRef.current;
      if (video) {
        video.pause?.();
        video.srcObject = null;
      }
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

    // Esperamos a que el modal monte el <video>
    setTimeout(async () => {
      try {
        const video = scannerVideoRef.current;
        if (!video) {
          setScannerError("No se pudo inicializar el video del scanner.");
          return;
        }

        // Si quedó algo previo, lo detenemos
        stopScanner();

        // ⚡ timeBetweenScans: cuanto más bajo, más intenta decodificar (más CPU)
        // 60–120 suele ser el sweet spot. Yo lo dejo en 80 para “rapidísimo”.
        const reader = new BrowserMultiFormatReader(ZXING_HINTS, 80);
        readerRef.current = reader;
        isScanningRef.current = true;

        // ⚡ Constraints para rendimiento (evitar 1080p)
        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },   // rápido
            height: { ideal: 480 },  // rápido
            frameRate: { ideal: 30, max: 60 },
          },
        };

        await reader.decodeFromConstraints(constraints, video, (result) => {
          if (!isScanningRef.current) return;

          if (result) {
            const text = result.getText();

            if (navigator.vibrate) navigator.vibrate(60);

            addByBarcode(text);
            closeScanner();
          }
        });
      } catch (e) {
        stopScanner();

        // Si constraints fallan, fallback a video:true (algunos dispositivos)
        if (e?.name === "OverconstrainedError") {
          try {
            const video = scannerVideoRef.current;
            if (!video) {
              setScannerError("No se pudo inicializar el video del scanner.");
              return;
            }

            const reader = new BrowserMultiFormatReader(ZXING_HINTS, 80);
            readerRef.current = reader;
            isScanningRef.current = true;

            await reader.decodeFromConstraints({ audio: false, video: true }, video, (result) => {
              if (!isScanningRef.current) return;
              if (result) {
                const text = result.getText();
                if (navigator.vibrate) navigator.vibrate(60);
                addByBarcode(text);
                closeScanner();
              }
            });

            return;
          } catch (e2) {
            e = e2;
          }
        }

        const msg =
          e?.name === "NotAllowedError"
            ? "Permiso denegado. Habilitá la cámara."
            : e?.name === "NotFoundError"
            ? "No se encontró cámara."
            : e?.name === "NotReadableError"
            ? "La cámara está ocupada por otra app."
            : `Error al iniciar scanner: ${e?.name || "desconocido"}`;

        setScannerError(msg);
      }
    }, 80);
  };

  return (
    <div className="home-wrap">
      <header className="home-header">
        <div className="home-brand">
          <h1>POS Mobile</h1>
          <p>Escaneo rápido (ZXing optimizado) + lista</p>
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
              <div className="desc">
                <div className="desc-title">{it.descripcion}</div>
                <div className="desc-code">Cod: {it.codigo}</div>
              </div>

              <div className="right" data-label="Precio">
                ${it.precio.toLocaleString("es-AR")}
              </div>
              <div className="right" data-label="Cant.">
                {it.cantidad}
              </div>
              <div className="right" data-label="Subtotal">
                ${it.subtotal.toLocaleString("es-AR")}
              </div>
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
              <h2>Escanear</h2>
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
              Tip: acercá el código 10–15 cm y que ocupe buen tamaño en pantalla.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
