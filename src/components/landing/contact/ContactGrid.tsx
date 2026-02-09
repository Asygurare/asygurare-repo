"use client"
import { Send, User2Icon, X, Cpu } from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import { supabaseClient } from "@/src/lib/supabase/client";

interface Contact_Messages{
    name: string;
    email: string;
    message: string;
}
export default function ContactGrid() {
    const [contactPanel, setContactPanel] = useState(false)
    const [assitantPanel, setAssitantPanel] = useState(false)
    const [formData, setFormData] = useState<Contact_Messages>({
        name: "",
        email: "",
        message: ""
    })

    async function handleSubmit() {
        const { error } = await supabaseClient
            .from("CONTACT_MESSAGES")
            .insert(formData)

            if (error){
                alert("Hubo un error al enviar tu mensaje")
            }
            setContactPanel(false)
            alert("Mensaje enviado con éxito")
        
    }
    return (
        <main className="px-5 md:px-20 overflow-x-hidden">
            {contactPanel && (
                            <div className="fixed inset-0 w-full h-full bg-black/60 p-35">
                                <div className="bg-white w-full h-full p-10">
                                    <div className="text-(--accents) justify-between font-bold flex mb-8 italic text-4xl w-full items-center"><Image src="/logo/logo.png" alt="logo" width={54} height={54} className="mb-15" /><h1>Contáctanos</h1><X onClick={() => setContactPanel(false)} className="z-50 text-red-500"/></div>
                                    <div className="space-y-8">
                                        <div className="flex flex-col">
                                            <label className="text-(--accents) font-bold text-sm">Ingresa tu nombre completo:</label>
                                            <input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ej. Alonso Mendez" className="border-(--accents) border-1 text-black pl-2"></input>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-(--accents) font-bold text-sm">Ingresa tu correo electrónico:</label>
                                            <input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Ej. tu@email.com" className="border-(--accents) border-1 text-black pl-2"></input>
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-(--accents) font-bold text-sm">Mensaje</label>
                                            <textarea value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} placeholder="¿Qué nos quieres decir?" className="border-(--accents) border-1 text-black pl-2"></textarea>
                                        </div>
                                        <div className="flex flex-col items-center justify-center">
                                            <button onClick={handleSubmit} className="bg-(--accents) text-white hover:bg-blue-600 flex items-center justify-center w-auto p-3 rounded-md">
                                                <Send  /> Enviar
                                            </button>
                                        </div>

                                    </div>
                                </div>

                            </div>
                        )}

            <div>
                <h1 className="text-5xl md:text-[7rem] font-medium leading-[0.85] tracking-tighter mb-12">
                    Queremos <br />
                    <span className="text-(--main) italic">conocerte.</span>
                </h1>
            </div>
            <div className="grid grid-cols-1  text-white gap-8 w-full h-full p-10 mt-3 bg-white border-3 border-(--accents) rounded-md">
                <div className="w-full ">
                    <div onClick={() => setContactPanel(true)} className="flex bg-(--accents) gap-2 border-3 border-(--accents) justify-center items-center p-5">
                        <Send />
                        <h1 className="font-bold">
                            Envíanos un mensaje
                        </h1>
                    </div>
                    <a  href="https://cal.com/asygurare/30min" target="_blank" rel="noopener noreferrer">
                    <div  className="flex gap-2 bg-(--accents) mt-3 font-bold  border-3 border-(--accents) justify-center items-center p-5">
                        <User2Icon />
                        <h1>
                            Agenda una reunión
                        </h1>
                    </div>
                    </a>
                </div>
            </div>
        </main>
    )
}