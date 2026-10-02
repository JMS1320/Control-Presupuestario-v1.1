-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 73 · EL «EXTRACTO» DE LOS ECHEQS DE TERCEROS — una cuenta más de conciliación   A-FEAT-1230 · 2026-10-02
-- ─────────────────────────────────────────────────────────────────────────────────────────────
--
-- Pedido del usuario: *«lo único que deberíamos es crear el extracto bancario de echeqs en
-- conciliación, así ahí figura el echeq que entra con su cuenta y el echeq que sale con su cuenta.
-- Es sólo para endosados, ya que los emitidos salen de cuenta corriente. De esa manera mantenemos
-- simple el panel de gestión, pero la estructura de conciliación queda completa sin reducir datos»*.
--
-- Es una CUENTA como las cajas: misma forma que `msa.caja_general` (así el Extracto, la conciliación
-- y el dashboard la tratan igual), con dos vínculos más:
--   · `anticipo_id`          → el cheque recibido (entrada) o el pago endosado (salida). ÚNICO: una
--                              fila por cada uno, así la sincronización no duplica nunca.
--   · `comprobante_venta_id` → la venta que cobró ese cheque (la entrada).
-- La salida usa el `comprobante_arca_id` que ya trae la forma de caja (la factura que se pagó).
--
-- Permisos: los mismos que las cajas (RLS por sección, recurso `extracto`). Se registra en
-- `recurso_tablas` en el mismo script — una tabla sin registrar quedaría abierta (A-SEC-14).
-- Avisado a Javier ANTES de correrlo (ENTRE-DESARROLLADORES).
-- 🔙 Deshacer: `scripts/73-extracto-echeqs-terceros-deshacer.sql` (con freno si ya tiene filas).
-- ─────────────────────────────────────────────────────────────────────────────────────────────

begin;

create table if not exists msa.echeqs_terceros (like msa.caja_general including all);

alter table msa.echeqs_terceros
  add column if not exists anticipo_id uuid references public.anticipos_proveedores(id) on delete set null,
  add column if not exists comprobante_venta_id uuid references msa.comprobantes_venta(id) on delete set null;

create unique index if not exists echeqs_terceros_anticipo_unico on msa.echeqs_terceros (anticipo_id);

comment on table msa.echeqs_terceros is
  'A-FEAT-1230 — «extracto» de los echeqs de clientes: entra el cheque recibido (crédito, cuenta de la venta) y sale el endoso (débito, cuenta de la factura pagada). Se genera desde los cheques (anticipos), una fila por anticipo.';

alter table msa.echeqs_terceros enable row level security;
create policy ver_segun_permiso on msa.echeqs_terceros for select to authenticated
  using (public.puede_ver('msa', 'echeqs_terceros'));
create policy escribir_segun_permiso on msa.echeqs_terceros for all to authenticated
  using (public.puede_escribir('msa', 'echeqs_terceros'))
  with check (public.puede_escribir('msa', 'echeqs_terceros'));

revoke all on msa.echeqs_terceros from anon;
grant select, insert, update, delete on msa.echeqs_terceros to authenticated;
grant all on msa.echeqs_terceros to service_role;

insert into public.recurso_tablas (schema_nombre, tabla, recurso, motivo, restringe_lectura)
values ('msa', 'echeqs_terceros', 'extracto', 'Echeqs de terceros (A-FEAT-1230): cuenta de conciliación de los cheques recibidos y endosados.', false)
on conflict do nothing;

commit;

notify pgrst, 'reload schema';
