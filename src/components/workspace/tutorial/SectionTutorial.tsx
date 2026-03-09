"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CircleHelp } from "lucide-react"

export type SectionTutorialStep = {
  id: string
  title: string
  description: string
  selector: string
}

type SectionTutorialProps = {
  steps: SectionTutorialStep[]
  ariaLabel: string
  triggerLabel?: string
  triggerClassName?: string
  onBeforeStart?: () => void
  zIndexBase?: number
}

export function SectionTutorial({
  steps,
  ariaLabel,
  triggerLabel = "Tutorial",
  triggerClassName,
  onBeforeStart,
  zIndexBase = 95,
}: SectionTutorialProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  const closeTutorial = useCallback(() => {
    setIsOpen(false)
    setStepIndex(0)
    setTargetRect(null)
  }, [])

  const updateTarget = useCallback(() => {
    if (!isOpen || !step) return
    const el = document.querySelector(step.selector) as HTMLElement | null
    if (!el) {
      setTargetRect(null)
      return
    }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    setTargetRect(el.getBoundingClientRect())
  }, [isOpen, step])

  useEffect(() => {
    if (!isOpen) return
    updateTarget()
    const onLayoutChange = () => updateTarget()
    window.addEventListener("resize", onLayoutChange)
    window.addEventListener("scroll", onLayoutChange, true)
    return () => {
      window.removeEventListener("resize", onLayoutChange)
      window.removeEventListener("scroll", onLayoutChange, true)
    }
  }, [isOpen, stepIndex, updateTarget])

  const openTutorial = () => {
    onBeforeStart?.()
    setStepIndex(0)
    setIsOpen(true)
  }

  const tooltipPosition = useMemo(() => {
    if (!targetRect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    }
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
    const padding = 16
    const maxLeft = viewportWidth - 360 - padding
    const preferredLeft = Math.max(padding, Math.min(targetRect.left, maxLeft))
    const hasRoomBottom = targetRect.bottom + 240 < viewportHeight
    if (hasRoomBottom) return { top: `${targetRect.bottom + 12}px`, left: `${preferredLeft}px` }
    return { top: `${Math.max(padding, targetRect.top - 220)}px`, left: `${preferredLeft}px` }
  }, [targetRect])

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800
  const morphTransition = { type: "spring" as const, stiffness: 280, damping: 30, mass: 0.7 }
  const holeRect = useMemo(() => {
    if (!targetRect) return null
    const top = Math.max(0, targetRect.top - 8)
    const left = Math.max(0, targetRect.left - 8)
    const width = Math.max(0, targetRect.width + 16)
    const height = Math.max(0, targetRect.height + 16)
    const right = Math.min(viewportWidth, left + width)
    const bottom = Math.min(viewportHeight, top + height)
    return { top, left, width, height, right, bottom }
  }, [targetRect, viewportWidth, viewportHeight])

  const overlayZ = zIndexBase
  const highlightZ = zIndexBase + 5
  const tooltipZ = zIndexBase + 10

  return (
    <>
      <button type="button" onClick={openTutorial} className={triggerClassName}>
        <CircleHelp size={14} />
        {triggerLabel}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {holeRect ? (
              <>
                <motion.button
                  type="button"
                  aria-label="Cerrar tutorial"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, top: 0, left: 0, height: holeRect.top }}
                  exit={{ opacity: 0 }}
                  className="fixed bg-black/45 backdrop-blur-sm"
                  style={{ width: "100vw", zIndex: overlayZ }}
                  transition={morphTransition}
                  onClick={closeTutorial}
                />
                <motion.button
                  type="button"
                  aria-label="Cerrar tutorial"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    top: holeRect.bottom,
                    left: 0,
                    height: Math.max(0, viewportHeight - holeRect.bottom),
                  }}
                  exit={{ opacity: 0 }}
                  className="fixed bg-black/45 backdrop-blur-sm"
                  style={{ width: "100vw", zIndex: overlayZ }}
                  transition={morphTransition}
                  onClick={closeTutorial}
                />
                <motion.button
                  type="button"
                  aria-label="Cerrar tutorial"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    top: holeRect.top,
                    left: 0,
                    width: holeRect.left,
                    height: holeRect.height,
                  }}
                  exit={{ opacity: 0 }}
                  className="fixed bg-black/45 backdrop-blur-sm"
                  style={{ zIndex: overlayZ }}
                  transition={morphTransition}
                  onClick={closeTutorial}
                />
                <motion.button
                  type="button"
                  aria-label="Cerrar tutorial"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    top: holeRect.top,
                    left: holeRect.right,
                    width: Math.max(0, viewportWidth - holeRect.right),
                    height: holeRect.height,
                  }}
                  exit={{ opacity: 0 }}
                  className="fixed bg-black/45 backdrop-blur-sm"
                  style={{ zIndex: overlayZ }}
                  transition={morphTransition}
                  onClick={closeTutorial}
                />
              </>
            ) : (
              <motion.button
                type="button"
                aria-label="Cerrar tutorial"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                style={{ zIndex: overlayZ }}
                onClick={closeTutorial}
              />
            )}

            {targetRect && (
              <motion.div
                initial={{
                  opacity: 0,
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                }}
                animate={{
                  opacity: 1,
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                }}
                exit={{ opacity: 0 }}
                className="fixed pointer-events-none rounded-2xl border-2 border-white shadow-2xl"
                style={{ zIndex: highlightZ }}
                transition={morphTransition}
              />
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed w-[min(92vw,360px)] bg-white rounded-[1.5rem] border border-black/10 shadow-2xl p-5 space-y-4 transition-[top,left,transform] duration-300 ease-out"
              style={{ ...tooltipPosition, zIndex: tooltipZ }}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
            >
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                  Paso {stepIndex + 1} de {steps.length}
                </p>
                <h4 className="text-lg font-black text-black tracking-tight">{step?.title}</h4>
                <p className="text-sm font-bold text-black/70">{step?.description}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={closeTutorial}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border border-black/15 text-black hover:bg-black/5 transition-colors"
                >
                  Cerrar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    disabled={stepIndex === 0}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border border-black/15 text-black disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLastStep) {
                        closeTutorial()
                        return
                      }
                      setStepIndex((i) => Math.min(steps.length - 1, i + 1))
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide bg-black text-white hover:bg-black/90 transition-colors"
                  >
                    {isLastStep ? "Finalizar" : "Siguiente"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
