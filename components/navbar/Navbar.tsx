"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ArrowRight, ShieldCheck } from 'lucide-react'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Controlar el cambio de estilo al hacer scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { name: 'Funciones', href: '/sections' },
    { name: 'Nosotros', href: '/about' },
    { name: 'Precios', href: '/pricing' },
  ]

  return (
    <nav className="fixed top-0 w-full z-[100] px-7 pt-6 transition-all duration-500">
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`max-w-7xl mx-auto rounded-2xl md:rounded-full transition-all duration-300 border ${
          isScrolled 
            ? 'bg-white/80 backdrop-blur-md border-white/20 shadow-[0_8px_32px_rgba(74,119,102,0.1)] py-3 px-6' 
            : 'bg-transparent border-transparent py-5 px-4'
        }`}
      >
        <div className="flex items-center justify-between">
          
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-(--accents) rounded-lg flex items-center justify-center text-[#ece7e2] transition-transform group-hover:rotate-12">
              <ShieldCheck size={20} />
            </div>
            <span className="text-xl font-bold tracking-tighter text-[#1a1a1a]">
              ASYGURARE<span className="text-[#4A7766]">.</span>
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-[#4A7766] relative ${
                  pathname === link.href ? 'text-[#4A7766]' : 'text-gray-600'
                }`}
              >
                {link.name}
                {pathname === link.href && (
                  <motion.div 
                    layoutId="nav-underline"
                    className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#4A7766]"
                  />
                )}
              </Link>
            ))}
          </div>

          {/* CTA BUTTONS */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-bold text-gray-600 hover:text-[#1a1a1a] transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link href="/signup">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-(--accents) text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[#4A7766]/20 flex items-center gap-2 group"
            >
              Empieza Gratis
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
            </Link>
          </div>

          {/* MOBILE TOGGLE */}
          <button 
            className="md:hidden p-2 text-gray-600"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </motion.div>

      {/* MOBILE MENU OVERLAY */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-4 bg-white rounded-3xl border border-black/5 overflow-hidden shadow-2xl"
          >
            <div className="flex flex-col p-6 gap-6">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-medium text-gray-800"
                >
                  {link.name}
                </Link>
              ))}
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-4">
                <Link href="/login" className="text-lg font-medium text-gray-500">Iniciar Sesión</Link>
                <button className="bg-(--accents) text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                  Empieza Gratis <ArrowRight size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}