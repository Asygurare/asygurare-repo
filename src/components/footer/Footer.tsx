"use client"
import Link from "next/link"

export default function Footer(){
    return(
        <footer className="py-12 bg-(--bg) px-7 border-t border-black/5 text-sm text-gray-500 flex justify-between">
        <p>© 2026 Asygurare. Todos los derechos reservados.</p>
        <div className="flex gap-6">
          <Link href="/privacy">Privacidad</Link>
          <Link href="/terms">Términos</Link>
        </div>
      </footer>
    )
}