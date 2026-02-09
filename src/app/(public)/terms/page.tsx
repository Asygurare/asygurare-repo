"use client";

import Link from "next/link";

const LAST_UPDATED = "9 de febrero de 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-(--bg) px-7 pt-36 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <span className="inline-block px-4 py-1.5 bg-(--accents) border border-[#4A7766]/20 rounded-full text-white text-xs font-bold tracking-widest uppercase mb-6">
            Legal
          </span>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.05] text-(--text) mb-4">
            Términos y Condiciones
          </h1>
          <p className="text-base md:text-lg text-gray-600 leading-relaxed">
            Estos Términos regulan el acceso y uso de Asygurare y sus funcionalidades. Al usar nuestro
            sitio o servicios, aceptas estos Términos.
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Última actualización: <span className="font-medium">{LAST_UPDATED}</span>
          </p>
        </header>

        <section className="rounded-3xl bg-white/50 border border-black/5 p-6 md:p-8 mb-10">
          <h2 className="text-xl md:text-2xl font-semibold text-(--text) mb-4">Resumen rápido</h2>
          <ul className="space-y-2 text-gray-700 leading-relaxed">
            <li>- Debes usar Asygurare de forma legal y responsable.</li>
            <li>- Eres responsable de la confidencialidad de tu cuenta.</li>
            <li>- El servicio se ofrece “tal cual” y puede cambiar con el tiempo.</li>
            <li>- Tu uso también está sujeto a nuestra Política de Privacidad.</li>
          </ul>
        </section>

        <nav className="mb-12">
          <h2 className="text-lg font-semibold text-(--text) mb-4">Contenido</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-gray-700">
            <a className="hover:underline" href="#aceptacion">
              1. Aceptación de los términos
            </a>
            <a className="hover:underline" href="#servicio">
              2. Descripción del servicio
            </a>
            <a className="hover:underline" href="#cuentas">
              3. Cuentas y acceso
            </a>
            <a className="hover:underline" href="#uso">
              4. Uso permitido y prohibido
            </a>
            <a className="hover:underline" href="#propiedad">
              5. Propiedad intelectual
            </a>
            <a className="hover:underline" href="#datos">
              6. Datos y privacidad
            </a>
            <a className="hover:underline" href="#terceros">
              7. Servicios de terceros
            </a>
            <a className="hover:underline" href="#garantias">
              8. Exenciones y limitación de responsabilidad
            </a>
            <a className="hover:underline" href="#terminacion">
              9. Suspensión y terminación
            </a>
            <a className="hover:underline" href="#cambios">
              10. Cambios a estos términos
            </a>
            <a className="hover:underline" href="#contacto">
              11. Contacto
            </a>
          </div>
        </nav>

        <article className="space-y-10 text-gray-800 leading-relaxed">
          <section id="aceptacion" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              1. Aceptación de los términos
            </h2>
            <p>
              Al acceder o utilizar Asygurare, confirmas que has leído, entendido y aceptas estos
              Términos. Si no estás de acuerdo, no debes usar el sitio o los servicios.
            </p>
          </section>

          <section id="servicio" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              2. Descripción del servicio
            </h2>
            <p>
              Asygurare es una plataforma para apoyar procesos operativos y comerciales relacionados con
              la gestión de prospectos, clientes, pólizas y actividades, incluyendo funciones de
              automatización y asistencia.
            </p>
            <p className="mt-4">
              Asygurare no es una aseguradora y no ofrece asesoría legal, fiscal o financiera. La
              información presentada se provee con fines generales.
            </p>
          </section>

          <section id="cuentas" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              3. Cuentas y acceso
            </h2>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>- Debes proporcionar información veraz y mantenerla actualizada.</li>
              <li>- Eres responsable de mantener la confidencialidad de tus credenciales.</li>
              <li>
                - Debes notificarnos si sospechas de uso no autorizado de tu cuenta o una brecha de
                seguridad.
              </li>
            </ul>
          </section>

          <section id="uso" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              4. Uso permitido y prohibido
            </h2>
            <p>Te comprometes a usar el servicio de manera legal y a no:</p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>- Infringir leyes aplicables o derechos de terceros.</li>
              <li>- Intentar acceder sin autorización a sistemas, cuentas o datos.</li>
              <li>- Interferir con la operación del servicio (por ejemplo, ataques, scraping abusivo).</li>
              <li>- Cargar contenido malicioso (virus, malware) o datos sin autorización.</li>
              <li>- Usar el servicio para enviar spam o comunicaciones no solicitadas.</li>
            </ul>
          </section>

          <section id="propiedad" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              5. Propiedad intelectual
            </h2>
            <p>
              Asygurare y sus contenidos (incluyendo software, marcas, diseños, textos y gráficos) están
              protegidos por derechos de propiedad intelectual. No se te otorga ningún derecho, licencia
              o propiedad salvo lo expresamente indicado en estos Términos.
            </p>
          </section>

          <section id="datos" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              6. Datos y privacidad
            </h2>
            <p>
              El tratamiento de datos personales se rige por nuestra{" "}
              <Link className="underline" href="/privacy">
                Política de Privacidad
              </Link>
              . Si incorporas datos de terceros (por ejemplo, tus clientes) a la plataforma, garantizas
              que cuentas con una base legal y autorizaciones necesarias para hacerlo.
            </p>
          </section>

          <section id="terceros" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              7. Servicios de terceros
            </h2>
            <p>
              Podemos apoyarnos en proveedores para operar el servicio (por ejemplo, infraestructura,
              analítica o mensajería). El uso de servicios de terceros puede estar sujeto a términos
              propios de esos terceros.
            </p>
          </section>

          <section id="garantias" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              8. Exenciones y limitación de responsabilidad
            </h2>
            <p>
              El servicio se ofrece “tal cual” y “según disponibilidad”. En la máxima medida permitida
              por la ley, Asygurare no ofrece garantías expresas o implícitas de comerciabilidad,
              idoneidad para un propósito particular o no infracción.
            </p>
            <p className="mt-4">
              En la máxima medida permitida por la ley, Asygurare no será responsable por daños
              indirectos, incidentales, especiales o consecuentes, ni por pérdida de datos, ingresos o
              beneficios derivados del uso o imposibilidad de uso del servicio.
            </p>
          </section>

          <section id="terminacion" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              9. Suspensión y terminación
            </h2>
            <p>
              Podemos suspender o terminar el acceso al servicio si creemos razonablemente que existe
              incumplimiento de estos Términos, riesgo de seguridad o requerimiento legal. Cuando sea
              razonable, intentaremos notificarte.
            </p>
          </section>

          <section id="cambios" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              10. Cambios a estos términos
            </h2>
            <p>
              Podemos actualizar estos Términos ocasionalmente. Publicaremos la versión vigente en esta
              página e indicaremos la fecha de última actualización. El uso continuado del servicio tras
              cambios constituye aceptación de los Términos actualizados.
            </p>
          </section>

          <section id="contacto" className="scroll-mt-32">
            <h2 className="text-2xl md:text-3xl font-semibold text-(--text) mb-3">
              11. Contacto
            </h2>
            <p>
              Si tienes dudas sobre estos Términos, contáctanos en{" "}
              <a className="underline" href="mailto:legal@asygurare.com">
                legal@asygurare.com
              </a>
              .
            </p>
          </section>
        </article>

        <div className="mt-14 pt-8 border-t border-black/5 text-sm text-gray-600 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p>
            ¿Necesitas revisar privacidad?{" "}
            <Link className="underline" href="/privacy">
              Política de Privacidad
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
