"use client"

import ContactGrid from "@/src/components/landing/contact/ContactGrid"

export default function ContactPage(){
    return(
        <main className="bg-(--bg) text-[#1a1a1a] min-h-screen overflow-x-hidden">
            <div className="pt-30 md:p-40">
            <ContactGrid/>
            </div>
        </main>
    )
}