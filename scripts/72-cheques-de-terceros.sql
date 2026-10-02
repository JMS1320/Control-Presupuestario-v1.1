-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 72 · CHEQUES DE TERCEROS EN CARTERA — recibir, tener disponible, endosar     A-FEAT-1229 · 2026-10-02
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario: *«ese cheque nos debe figurar disponible y debemos poner que le endosamos a
-- quien realmente le endosamos y ahí quedaría todo hecho»*. Caso: el echeq de Genta ($4.466.876,20)
-- que MSA endosó a Almacén Veterinario.
--
-- El cheque recibido es un anticipo de COBRO (`anticipos_proveedores`, tipo 'cobro', metodo_pago
-- 'echeq'). Faltaban dos cosas:
--   1. Un estado para «lo tengo, todavía no lo usé»: `estado_pago = 'en_cartera'`.
--   2. A QUÉ PAGO se endosó: `endosado_en_id` → el anticipo de PAGO al proveedor que se canceló
--      con ese cheque. Del otro lado, ese pago queda `metodo_pago = 'echeq'`, `estado_pago =
--      'endosado'` (valor que ya existe desde scripts/71): no se espera en el banco.
--
-- No toca filas, permisos, RLS ni vistas. Avisado a Javier ANTES de correrlo (ENTRE-DESARROLLADORES).
-- 🔙 Deshacer: `scripts/72-cheques-de-terceros-deshacer.sql` (con freno si ya se usó).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table public.anticipos_proveedores drop constraint anticipos_proveedores_estado_pago_check;
alter table public.anticipos_proveedores add constraint anticipos_proveedores_estado_pago_check
  check (estado_pago::text = any (array['pendiente','pagar','preparado','programado','pagado','echeq','conciliado','endosado','en_cartera']::text[]));

alter table public.anticipos_proveedores
  add column if not exists endosado_en_id uuid references public.anticipos_proveedores(id) on delete set null;

comment on column public.anticipos_proveedores.endosado_en_id is
  'A-FEAT-1229 — en un cheque de tercero recibido (tipo cobro, echeq): el anticipo de PAGO al proveedor que se canceló endosándolo.';

commit;

notify pgrst, 'reload schema';
