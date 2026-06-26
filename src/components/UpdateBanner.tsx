import { useRegisterSW } from "virtual:pwa-register/react";
import { APP_VERSION } from "../version";

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(registration: ServiceWorkerRegistration | undefined) {
      if (!registration) return;
      const check = () => void registration.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.setInterval(check, 60 * 60 * 1000);
    }
  });

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="alert">
      <div className="update-banner-text">
        <strong>Nueva versión disponible</strong>
        <span>v{APP_VERSION} — pulsa actualizar para cargar los últimos cambios</span>
      </div>
      <div className="update-banner-actions">
        <button
          className="btn primary"
          onClick={() => void updateServiceWorker(true)}
        >
          Actualizar
        </button>
        <button className="btn ghost" onClick={() => setNeedRefresh(false)}>
          Después
        </button>
      </div>
    </div>
  );
}
