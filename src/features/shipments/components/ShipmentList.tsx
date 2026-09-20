"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Package, PackageCheck, AlertCircle, Camera, Check, Plus, Link as LinkIcon, Copy, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface ShipmentItem {
  id: string;
  name: string;
  declared_qty: number;
  received_qty?: number;
}

export default function ShipmentList() {
  const t = useTranslations("Shipments");
  const [selectedColis, setSelectedColis] = useState<string | null>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  
  // Link generation state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  // Mock data representing a shipment from the intermediary
  const mockShipments = [
    {
      id: "SHP-123",
      supplier: "Intermédiaire (Dubaï)",
      date: "2026-08-29",
      status: "pending", // pending, received
      photo_url: "https://via.placeholder.com/400x300?text=Photo+Colis+Scell%C3%A9",
      items: [
        { id: "itm1", name: "Lait corps éclaircissant HT26", declared_qty: 50 },
        { id: "itm2", name: "Sérum visage", declared_qty: 120 },
      ],
    }
  ];

  const handlePointer = (id: string) => {
    setSelectedColis(id);
  };

  const handleValidate = () => {
    alert(t("validate_success"));
    setSelectedColis(null);
  };

  const handleGenerateLink = () => {
    const fakeId = Math.random().toString(36).substring(7);
    setGeneratedLink(`http://localhost:3000/fr/procurement/${fakeId}`);
    setIsLinkModalOpen(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert(t("link_copied"));
  };

  return (
    <div className="space-y-6">
      
      {/* Bouton de génération de lien */}
      <div className="flex justify-end">
        <button 
          onClick={handleGenerateLink}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-violet-700 shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("generate_link")}
        </button>
      </div>

      {/* Liste des arrivages */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockShipments.map(shipment => (
          <div key={shipment.id} className="rounded-xl border bg-card p-6 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{shipment.id}</h3>
                <p className="text-sm text-muted-foreground">{shipment.supplier}</p>
                <p className="text-xs text-muted-foreground mt-1">{shipment.date}</p>
              </div>
              <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                <Package className="h-3 w-3" />
                {t("pending")}
              </div>
            </div>

            <div className="bg-muted rounded-md h-32 flex items-center justify-center overflow-hidden relative">
              <img src={shipment.photo_url} alt={t("proof")} className="object-cover w-full h-full opacity-80" />
              <div className="absolute bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                <Camera className="h-3 w-3" /> {t("proof")}
              </div>
            </div>

            <button 
              onClick={() => handlePointer(shipment.id)}
              className="w-full mt-2 py-2 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-sm font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
            >
              {t("verify")}
            </button>
          </div>
        ))}
      </div>

      {/* Modale de pointage */}
      {selectedColis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-xl shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">{t("verify")} - {selectedColis}</h2>
              <button onClick={() => setSelectedColis(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {t("verify_instruction")}
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className="bg-muted text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">{t("shipment_column")}</th>
                      <th className="px-4 py-3 text-center">{t("declared_qty")}</th>
                      <th className="px-4 py-3 text-center">{t("received_qty")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockShipments[0].items.map((item) => (
                      <tr key={item.id} className="bg-card">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{item.declared_qty}</td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            min="0"
                            placeholder={item.declared_qty.toString()}
                            value={receivedQtys[item.id] || ""}
                            onChange={(e) => setReceivedQtys(prev => ({...prev, [item.id]: Number(e.target.value)}))}
                            className="w-full max-w-[100px] mx-auto block rounded-md border p-2 text-center"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2 bg-muted/30">
              <button 
                onClick={() => setSelectedColis(null)}
                className="px-4 py-2 rounded-md border bg-background hover:bg-accent text-sm font-medium"
              >
                {t("cancel")}
              </button>
              <button 
                onClick={handleValidate}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {t("validate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for sharing Link */}
      <Modal 
        isOpen={isLinkModalOpen} 
        onClose={() => setIsLinkModalOpen(false)} 
        title={t("generate_link")}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("share_link_desc")}
          </p>
          
          <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
            <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <input 
              readOnly 
              value={generatedLink} 
              className="bg-transparent w-full outline-none text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button 
              onClick={copyToClipboard}
              className="flex items-center justify-center gap-2 border rounded-md py-2 hover:bg-accent text-sm font-medium"
            >
              <Copy className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("copy_link")}</span>
            </button>
            <a 
              href={`https://wa.me/?text=${t("whatsapp_msg")} ${generatedLink}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 bg-[#25D366] text-white rounded-md py-2 hover:bg-[#25D366]/90 text-sm font-medium"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{t("share_whatsapp")}</span>
            </a>
          </div>
        </div>
      </Modal>

    </div>
  );
}
