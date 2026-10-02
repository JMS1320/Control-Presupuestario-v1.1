-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 71 · El echeq de un cliente que se ENDOSA — un cobro que nunca pasa por el banco   A-FEAT-1228 · 2026-10-02
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Caso real: Genta pagó parte de la liquidación de enero (11-75880) con un echeq de $4.466.876,20,
-- y MSA lo endosó a Almacén Veterinario. Hoy ese echeq existe sólo como PAGO nuestro; del lado del
-- cobro no figura, y la venta queda con un saldo que en realidad está cobrado.
--
-- Se registra como un anticipo de COBRO (`anticipos_proveedores`, tipo 'cobro', metodo_pago
-- 'echeq') vinculado a la liquidación. Lo que faltaba es un estado que diga que NO va a entrar
-- al banco: `estado_pago = 'endosado'`. Sin él, el Cash Flow lo esperaría como un depósito que no
-- llega nunca, y la conciliación lo buscaría en el extracto para siempre.
--
-- Sólo agrega un valor permitido al CHECK. No toca filas, permisos, RLS ni vistas.
-- 🔙 Deshacer: `scripts/71-anticipo-echeq-endosado-deshacer.sql` (con freno si ya hay endosados).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

alter table public.anticipos_proveedores drop constraint anticipos_proveedores_estado_pago_check;
alter table public.anticipos_proveedores add constraint anticipos_proveedores_estado_pago_check
  check (estado_pago::text = any (array['pendiente','pagar','preparado','programado','pagado','echeq','conciliado','endosado']::text[]));

commit;

notify pgrst, 'reload schema';
