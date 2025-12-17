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
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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

  const openCameraTest = async () => {
    setCamError("");

    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setCamError("Este navegador no soporta cámara (getUserMedia).");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }, // trasera
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCamOpen(true);
    } catch (e) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Permiso denegado. Habilitá la cámara en el navegador."
          : e?.name === "NotFoundError"
          ? "No se encontró cámara en el dispositivo."
          : e?.name === "NotReadableError"
          ? "La cámara está ocupada por otra app."
          : `Error al abrir cámara: ${e?.name || "desconocido"}`;

      setCamError(msg);
      setCamOpen(false);
    }
  };

  const closeCameraTest = () => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  };

  return (
    <div className="home-wrap">
      <header className="home-header">
        <div>
          <h1>POS Mobile</h1>
          <p>Home básica: input + listado + total + test de cámara</p>
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

      {camError && <div className="cam-error">{camError}</div>}

      {camOpen && (
        <div className="cam-preview">
          <div className="cam-title">Preview cámara</div>
          <video ref={videoRef} className="cam-video" playsInline muted />
          <div className="cam-hint">
            Si esto se ve en el celu (Netlify HTTPS), ya tenemos permisos OK.
          </div>
        </div>
      )}

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
