'use client'

/**
 * Modal individual de "Completar datos del proveedor" en el bucle.
 *
 * Modos:
 *   - 'email': pide email_pagos
 *   - 'cbu':   pide CBU y/o Alias (uno o ambos, el que prefiera)
 *
 * Botones: Cancelar / Saltar este / Guardar
 *
 * Después de Guardar o Saltar → llama a onGuardado/onSaltado y el padre
 * pasa al siguiente o cierra el bucle.
 */

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { validarCBU, validarAlias } from '@/lib/lotes-galicia/helpers'

interface Props {
  open: boolean
  modo: 'email' | 'cbu'
  proveedor?: { proveedor_id: string; cuit: string; razon_social: string }
  indice: number
  total: number
  onGuardado: () => void
  onSaltado: () => void
  onCancelar: () => void
}

export function ModalCompletarDatosProveedor({
  open, modo, proveedor, indice, total, onGuardado, onSaltado, onCancelar,
}: Props) {
  const [email, setEmail] = useState('')
  const [cbu, setCbu] = useState('')
  const [alias, setAlias] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Reset al cambiar de proveedor
  useEffect(() => {
    setEmail('')
    setCbu('')
    setAlias('')
  }, [proveedor?.proveedor_id])

  async function guardar() {
    if (!proveedor) return
    const update: any = {}

    if (modo === 'email') {
      if (!email.trim()) { toast.error('Ingresá un email o usá Saltar'); return }
      update.email_pagos = email.trim()
    }

    if (modo === 'cbu') {
      if (!cbu && !alias) { toast.error('Ingresá CBU o Alias (al menos uno) o usá Saltar'); return }
      if (cbu) {
        if (!validarCBU(cbu)) { toast.error('CBU debe ser 22 dígitos numéricos'); return }
        update.cbu = cbu.replace(/\s/g, '')
      }
      if (alias) {
        if (!validarAlias(alias)) { toast.error('Alias debe ser 6-20 caracteres (letras, números, "." o "-")'); return }
        update.alias_cbu = alias.trim()
      }
    }

    setGuardando(true)
    try {
      const r = await fetch('/api/gas/config-proveedor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor_id: proveedor.proveedor_id, ...update }),
      })
      const d = await r.json()
      if (!d.ok) { toast.error('Error: ' + d.error); return }
      toast.success(`${proveedor.razon_social}: actualizado`)
      onGuardado()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    } finally { setGuardando(false) }
  }

  if (!proveedor) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !guardando && onCancelar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {modo === 'email' ? '✉️ Completar email' : '💳 Completar CBU / Alias'}
            <span className="text-sm font-normal text-gray-500 ml-2">({indice}/{total})</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            <b>{proveedor.razon_social}</b>
            <br />
            <span className="font-mono text-xs">CUIT: {proveedor.cuit}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {modo === 'email' && (
            <div>
              <Label className="text-xs">Email de pagos</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contacto@proveedor.com"
                autoFocus
              />
            </div>
          )}

          {modo === 'cbu' && (
            <>
              <p className="text-xs text-gray-600">
                Podés cargar CBU, Alias, o ambos. Si dejás los dos vacíos y das "Saltar",
                este proveedor quedará excluido del Excel.
              </p>
              <div>
                <Label className="text-xs">CBU (22 dígitos)</Label>
                <Input
                  value={cbu}
                  onChange={e => setCbu(e.target.value.replace(/\s/g, ''))}
                  placeholder="0070123412345600000000"
                  maxLength={22}
                  autoFocus
                />
                {cbu && !validarCBU(cbu) && (
                  <p className="text-[10px] text-red-600 mt-1">⚠ CBU debe ser exactamente 22 dígitos numéricos</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Alias (6-20 caracteres)</Label>
                <Input
                  value={alias}
                  onChange={e => setAlias(e.target.value)}
                  placeholder="nube.tren.mesa"
                />
                {alias && !validarAlias(alias) && (
                  <p className="text-[10px] text-red-600 mt-1">⚠ Alias 6-20 chars (letras, números, "." o "-")</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onCancelar} disabled={guardando} size="sm">Cancelar bucle</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSaltado} disabled={guardando} size="sm">Saltar este</Button>
            <Button onClick={guardar} disabled={guardando} size="sm">
              {guardando ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
