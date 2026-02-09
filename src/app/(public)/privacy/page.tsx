"use client";

import Link from "next/link";

const LAST_UPDATED = "9 de febrero de 2026";

export default function Privacy() {
  return (
    <main className="min-h-screen bg-(--bg) px-7 pt-36 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <span className="inline-block px-4 py-1.5 bg-(--accents) border border-[#4A7766]/20 rounded-full text-white text-xs font-bold tracking-widest uppercase mb-6">
            Legal
          </span>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.05] text-(--text) mb-4">
            Política de Privacidad y Tratamiento de Datos
          </h1>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">
            Esta Política describe cómo Asygurare recopila, usa y protege tus datos personales cuando
            visitas nuestro sitio web y/o usas nuestros servicios.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Última actualización: <span className="font-medium">{LAST_UPDATED}</span>
          </p>
        </header>

        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-10">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">Resumen rápido</h2>
          <ul className="space-y-2 text-gray-700 leading-relaxed">
            <li>
              - Usamos tus datos para operar el servicio, responder consultas, mejorar la experiencia y
              cumplir obligaciones legales.
            </li>
            <li>
              - Los datos de tus clientes (si los cargas en la plataforma) no se comparten con terceros
              para fines comerciales propios de esos terceros.
            </li>
            <li>
              - Puedes solicitar acceso, rectificación, eliminación u oposición según tu normativa
              aplicable.
            </li>
            <li>- No usamos tus datos ni los datos de tus clientes para entrenar inteligencia artificial.</li>
          </ul>
        </section>

        <nav className="mb-12">
          <h2 className="text-lg font-semibold text-(--text) mb-4">Contenido</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-gray-700">
            <a className="hover:underline" href="#responsable">
              1. Responsable y contacto
            </a>
            <a className="hover:underline" href="#datos">
              2. Datos que recopilamos
            </a>
            <a className="hover:underline" href="#finalidades">
              3. Finalidades y base legal
            </a>
            <a className="hover:underline" href="#cookies">
              4. Cookies y tecnologías similares
            </a>
            <a className="hover:underline" href="#compartimos">
              5. Con quién compartimos datos
            </a>
            <a className="hover:underline" href="#conservacion">
              6. Conservación y seguridad
            </a>
            <a className="hover:underline" href="#derechos">
              7. Tus derechos
            </a>
            <a className="hover:underline" href="#cambios">
              8. Cambios a esta Política
            </a>
          </div>
        </nav>

        <article className="space-y-10 text-gray-800 leading-relaxed">
          <section id="responsable" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              1. Responsable y contacto
            </h2>
            <p>
              El responsable del tratamiento de los datos personales es <span className="font-medium">Asygurare</span>.
              Si tienes preguntas sobre esta Política o deseas ejercer tus derechos, puedes escribirnos a{" "}
              <a className="underline" href="mailto:privacidad@asygurare.com">
                privacidad@asygurare.com
              </a>
              .
            </p>
            <p className="text-sm text-gray-600 mt-3">
              Nota: si tu organización (por ejemplo, una correduría/asesoría) contrata Asygurare, puede
              existir una relación “responsable–encargado” adicional. En ese caso, el alcance exacto
              dependerá del contrato y/o acuerdo de tratamiento de datos aplicable.
            </p>
          </section>

          <section id="datos" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              2. Datos que recopilamos
            </h2>
            <p>Podemos recopilar las siguientes categorías de datos, según cómo interactúes con nosotros:</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white/50 border border-black/5 p-5">
                <h3 className="font-semibold text-(--text) mb-2">Datos de contacto</h3>
                <p className="text-gray-700">
                  Nombre, correo electrónico, teléfono y el contenido de tus mensajes cuando completas
                  formularios o nos contactas.
                </p>
              </div>
              <div className="rounded-2xl bg-white/50 border border-black/5 p-5">
                <h3 className="font-semibold text-(--text) mb-2">Datos de uso</h3>
                <p className="text-gray-700">
                  Interacciones con el sitio y el producto (por ejemplo, páginas visitadas, eventos de
                  navegación, fecha/hora, fuente de tráfico).
                </p>
              </div>
              <div className="rounded-2xl bg-white/50 border border-black/5 p-5">
                <h3 className="font-semibold text-(--text) mb-2">Datos técnicos</h3>
                <p className="text-gray-700">
                  Dirección IP, identificadores de dispositivo, sistema operativo, navegador, idioma y
                  configuración aproximada.
                </p>
              </div>
              <div className="rounded-2xl bg-white/50 border border-black/5 p-5">
                <h3 className="font-semibold text-(--text) mb-2">Datos de cuenta (si aplica)</h3>
                <p className="text-gray-700">
                  Credenciales (por ejemplo, email y autenticación), preferencias y configuraciones
                  necesarias para operar la plataforma.
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Asygurare no solicita intencionalmente datos sensibles. Si por algún motivo compartes
              información sensible, lo haces bajo tu responsabilidad y solo la utilizaremos en la medida
              necesaria para atender tu solicitud.
            </p>
          </section>

          <section id="finalidades" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              3. Finalidades y base legal
            </h2>
            <p>Tratamos tus datos para las siguientes finalidades:</p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>- Proveer el sitio web y los servicios de Asygurare.</li>
              <li>- Responder consultas, solicitudes de demo y soporte.</li>
              <li>- Mejorar el producto, medir rendimiento y prevenir fraude/abuso.</li>
              <li>- Enviar comunicaciones operativas (por ejemplo, avisos de cambios relevantes).</li>
              <li>- Cumplir obligaciones legales y requerimientos de autoridades.</li>
            </ul>
            <p className="mt-4">
              La base legal puede incluir: tu consentimiento (por ejemplo, para ciertas cookies), la
              ejecución de un contrato o medidas precontractuales, el cumplimiento de obligaciones
              legales y/o nuestro interés legítimo en operar y asegurar el servicio.
            </p>
            <div className="rounded-2xl bg-white/50 border border-black/5 p-5 mt-4">
              <h3 className="font-semibold text-(--text) mb-2">Inteligencia artificial</h3>
              <p className="text-gray-700">
                Los datos que nos proporcionas (incluyendo los datos de tus clientes, si los incorporas a
                la plataforma) <span className="font-medium">no se utilizan para entrenar modelos de inteligencia artificial</span>,
                ni propios ni de terceros.
              </p>
            </div>
          </section>

          <section id="cookies" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              4. Cookies y tecnologías similares
            </h2>
            <p>
              Usamos cookies y tecnologías similares para que el sitio funcione, recordar preferencias y
              medir el uso. Nuestro banner de consentimiento es gestionado por Cookiebot.
            </p>
            <div className="rounded-2xl bg-white/50 border border-black/5 p-5 mt-4">
              <p className="text-gray-700">
                Puedes ajustar tus preferencias desde el banner de cookies (si está disponible) o desde
                la configuración de tu navegador. Si deshabilitas ciertas cookies, algunas funciones del
                sitio podrían no funcionar correctamente.
              </p>
            </div>
          </section>

          <section id="compartimos" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              5. Con quién compartimos datos
            </h2>
            <p>
              No vendemos tus datos. En particular, los datos de tus clientes (si los tratas dentro de
              Asygurare) no se comparten con terceros para sus propios fines. Podemos compartir datos
              únicamente en los siguientes casos:
            </p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>
                - Proveedores (encargados) que nos ayudan a operar el servicio (por ejemplo, hosting,
                infraestructura y base de datos como Supabase, correo y soporte), bajo instrucciones y
                con fines limitados a la prestación del servicio.
              </li>
              <li>- Autoridades competentes, si es requerido por ley o para proteger derechos y seguridad.</li>
            </ul>
            <p className="mt-4">
              Cuando utilizamos proveedores, buscamos que actúen bajo instrucciones y con medidas de
              seguridad razonables, y solo accedan a los datos necesarios para prestar el servicio.
            </p>
          </section>

          <section id="conservacion" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              6. Conservación y seguridad
            </h2>
            <p>
              Conservamos los datos solo durante el tiempo necesario para las finalidades descritas y/o
              los plazos exigidos por ley. Aplicamos medidas técnicas y organizativas orientadas a
              proteger la información frente a acceso no autorizado, alteración, divulgación o
              destrucción.
            </p>
            <p className="mt-4">
              Usamos medidas de seguridad estándar de la industria, incluyendo <span className="font-medium">cifrado en tránsito (TLS)</span>{" "}
              y <span className="font-medium">cifrado en reposo (AES-256)</span> provisto por nuestra infraestructura (por ejemplo, Supabase),
              además de controles de acceso y buenas prácticas operativas.
            </p>
            <p className="text-sm text-gray-600 mt-3">
              Ningún sistema es 100% seguro. Si detectas una vulnerabilidad o incidente, por favor
              contáctanos en{" "}
              <a className="underline" href="mailto:privacidad@asygurare.com">
                privacidad@asygurare.com
              </a>
              .
            </p>
          </section>

          <section id="derechos" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              7. Tus derechos
            </h2>
            <p>
              Dependiendo de tu país/region, puedes tener derechos sobre tus datos personales, como:
              acceso, rectificación, actualización, eliminación, portabilidad, limitación u oposición al
              tratamiento, y retirar tu consentimiento cuando corresponda.
            </p>
            <p className="mt-4">
              Para ejercerlos, envía tu solicitud a{" "}
              <a className="underline" href="mailto:privacidad@asygurare.com">
                privacidad@asygurare.com
              </a>{" "}
              indicando (i) tu nombre, (ii) el derecho que deseas ejercer y (iii) la información necesaria
              para validar tu identidad.
            </p>
          </section>

          <section id="cambios" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              8. Cambios a esta Política
            </h2>
            <p>
              Podemos actualizar esta Política ocasionalmente para reflejar cambios en el servicio o en
              requisitos legales. Publicaremos la versión vigente en esta página e indicaremos la fecha
              de última actualización.
            </p>
          </section>
        </article>

        <div className="mt-14 pt-8 border-t border-black/5 text-sm text-gray-600 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p>
            ¿Buscabas los términos? Revisa{" "}
            <Link className="underline" href="/terms">
              Términos y Condiciones
            </Link>
            .
          </p>
          <Link className="underline" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}