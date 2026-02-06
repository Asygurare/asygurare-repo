"use client"
import Image from "next/image"

export default function HomeHero() {
    return (
        <main>
            <div className="grid grid-col-1 md:grid-cols-2">
                <div className="flex flex-col justify-center">
                    <h1 className="items-center justify-center text-(--main) text-3xl font-bold">
                        Todo lo que un asesor necesita, en un solo lugar.
                    </h1>
                    <div className="">  
                        <p className="text-black">
                         Techguros te ayuda a convertir a tus prospectos en clientes.
                        </p>
                    </div>

                </div>
                <div>
                    <Image src="/home/HeroPhoto.png" alt="Foto Hero" width={500} height={500} className="w-full h-full" />
                </div>
            </div>
        </main>
    )
}