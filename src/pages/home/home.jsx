import React, { useMemo, useRef, useState } from "react";
import "./home.css";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

// Mock inicial (después lo vamos a persistir en localStorage si querés)
const INITIAL_DB = {
  "7791234567890": { nombre: "Coca Cola 500ml", descripcion: "Gaseosa", precio: 1500 },
  "7790000000001": { nombre: "Galletitas", descripcion: "Dulces", precio: 900 },
  "7790000000002": { nombre: "Yerba 1kg", descripcion: "Mate", precio: 3200 },
};

// ZXing hints para acelerar (formatos típicos POS)
const ZXING_HINTS = new Map();
ZXING_HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.CODE_128,
]);
ZXING_HINTS.set(DecodeHintType.TRY_HARDER, false);

export default function Home() {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]);
  const [productDB, setProductDB] = useState(INITIAL_DB);

  // ---- Scanner ----
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerVideoRef = useRef(null);
  const readerRef = useRef(null);
  const isScanningRef = useRef(false);

  // ---- Modal Alta ----
  const [altaOpen, setAltaOpen] = useState(false);
  const [altaError, setAltaError] = useState("");
  const [altaForm, setAltaForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    precio: "",
  });

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.subtotal, 0),
    [items]
  );

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

    setTimeout(async () => {
      try {
        const video = scannerVideoRef.current;
        if (!video) {
          setScannerError("No se pudo inicializar el video del scanner.");
          return;
        }

        stopScanner();

        // ⚡ más rápido
        const reader = new BrowserMultiFormatReader(ZXING_HINTS, 80);
        readerRef.current = reader;
        isScanningRef.current = true;

        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 60 },
          },
        };

        await reader.decodeFromConstraints(constraints, video, (result) => {
          if (!isScanningRef.current) return;
          if (!result) return;

          const code = result.getText();

          if (navigator.vibrate) navigator.vibrate(60);

          // agregamos automático (si no existe, abre alta)
          addByBarcode(code);
          closeScanner();
        });
      } catch (e) {
        stopScanner();
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

  const openAltaForCode = (code) => {
    setAltaError("");
    setAltaForm({
      codigo: String(code || "").trim(),
      nombre: "",
      descripcion: "",
      precio: "",
    });
    setAltaOpen(true);
  };

  const closeAlta = () => {
    setAltaOpen(false);
    setAltaError("");
  };

  const saveAlta = () => {
    const codigo = altaForm.codigo.trim();
    const nombre = altaForm.nombre.trim();
    const descripcion = altaForm.descripcion.trim();
    const precioNum = Number(String(altaForm.precio).replace(",", "."));

    if (!codigo) return setAltaError("Falta el código.");
    if (!nombre) return setAltaError("Falta el nombre comercial.");
    if (!Number.isFinite(precioNum) || precioNum <= 0)
      return setAltaError("Precio inválido.");

    // guardar en DB (state)
    setProductDB((prev) => ({
      ...prev,
      [codigo]: { nombre, descripcion, precio: precioNum },
    }));

    setAltaOpen(false);
    setAltaError("");

    // agregamos 1 unidad automáticamente al guardar
    addByBarcode(codigo);
  };

  const addByBarcode = (code) => {
    const clean = String(code || "").trim();
    if (!clean) return;

    setBarcode(clean);

    const prod = productDB[clean];
    if (!prod) {
      openAltaForCode(clean);
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
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precio: prod.precio,
          cantidad: 1,
          subtotal: prod.precio,
        },
      ];
    });
  };

  return (
    <div className="home-wrap">
      <header className="home-header">
        <div className="home-brand">
          <h1>POS Mobile</h1>
          <p>Escaneo + alta rápida de productos</p>
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
                <div className="desc-title">{it.nombre}</div>
                <div className="desc-sub">{it.descripcion || "—"}</div>
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
              Al detectar, se agrega. Si no existe, se abre “Alta de producto”.
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALTA PRODUCTO */}
      {altaOpen && (
        <div className="modal-overlay" onClick={closeAlta}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Alta de producto</h2>
              <button className="btn btn-danger" onClick={closeAlta}>
                Cerrar
              </button>
            </div>

            {altaError && <div className="modal-error">{altaError}</div>}

            <div className="modal-grid">
              <label className="field">
                <span>Código</span>
                <input
                  value={altaForm.codigo}
                  onChange={(e) =>
                    setAltaForm((p) => ({ ...p, codigo: e.target.value }))
                  }
                  placeholder="Código de barras"
                  inputMode="numeric"
                />
              </label>

              <label className="field">
                <span>Nombre comercial</span>
                <input
                  value={altaForm.nombre}
                  onChange={(e) =>
                    setAltaForm((p) => ({ ...p, nombre: e.target.value }))
                  }
                  placeholder="Ej: Arroz 1kg"
                />
              </label>

              <label className="field">
                <span>Descripción</span>
                <input
                  value={altaForm.descripcion}
                  onChange={(e) =>
                    setAltaForm((p) => ({ ...p, descripcion: e.target.value }))
                  }
                  placeholder="Ej: Largo fino / Marca X"
                />
              </label>

              <label className="field">
                <span>Precio</span>
                <input
                  value={altaForm.precio}
                  onChange={(e) =>
                    setAltaForm((p) => ({ ...p, precio: e.target.value }))
                  }
                  placeholder="Ej: 1500"
                  inputMode="decimal"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeAlta}>
                Cancelar
              </button>
              <button className="btn btn-secondary" onClick={saveAlta}>
                Guardar y agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
