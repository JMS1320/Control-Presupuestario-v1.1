#!/bin/bash
# 🚦 ¿Vercel publica este push? (JMS 01/11: «para no colapsar Vercel gratuito»; tope del plan: 100 publicaciones por día).
# Vercel corre esto antes de armar: si sale con 0 NO publica; con 1 publica.
#
# NO publica:
#  - las ramas jms/* (terminales en paralelo): se prueban cuando llegan a `desarrollo`;
#  - un push que sólo cambió documentación (*.md) o scripts SQL de la base: la app es la misma.
# Todo lo demás publica (incluidas las ramas de Javier y `main`).
#
# ⚠️ 22/11/2026: se compara contra lo ÚLTIMO PUBLICADO (`VERCEL_GIT_PREVIOUS_SHA`), no contra el commit anterior. Comparando
#    sólo HEAD^ → HEAD, la publicación de main del 22/11 (143 commits de código, el último sólo de CLAUDE.md) se canceló y
#    producción siguió con la versión del 14/11: Mercedes entró y vio los avisos y el Dashboard de JMS.
#
# ⚠️ Republicar después del tope diario: un commit VACÍO no alcanza (no cambia nada y esto lo saltea).
#    Usar «Redeploy» en Vercel, o un commit que toque algún archivo de la app (pasó el 01/11).

rama="$VERCEL_GIT_COMMIT_REF"
case "$rama" in
  jms/*) echo "🚦 Rama de una terminal en paralelo ($rama): no se publica."; exit 0 ;;
esac

base="$VERCEL_GIT_PREVIOUS_SHA"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  # Sin la última publicada a mano (primer push o clon corto que no la trae): se publica por las dudas.
  echo "🚦 No puedo comparar contra la última publicación: se publica."
  exit 1
fi

if git diff --quiet "$base" HEAD -- . ':(exclude)*.md' ':(exclude)scripts/*.sql'; then
  echo "🚦 Desde la última publicación sólo cambió documentación o scripts de la base: no se publica."
  exit 0
fi
echo "🚦 Cambió la app desde la última publicación: se publica."
exit 1
