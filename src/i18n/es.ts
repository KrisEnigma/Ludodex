import type { strings as enStrings } from './en';

export const strings: Record<keyof typeof enStrings, string> = {
  // Menu - top bar / chrome
  'menu.day_chip': 'Día {n}',
  'menu.settings_aria': 'Ajustes',
  'menu.brand_glitch': 'GLITCH',
  'menu.brand_salad': 'SALAD',

  // Menu - stats
  'menu.stat_streak': 'Racha',
  'menu.stat_solved': 'Resueltos',
  'menu.stat_best': 'Mejor',
  'menu.stat_empty': '--',

  // Menu - daily card
  'menu.daily_tag_today': 'HOY',
  'menu.daily_next_in': 'PRÓXIMO EN {time}',
  'menu.daily_play': '▶ Jugar',
  'menu.daily_play_again': '✓ Resuelto · Volver a jugar',

  // Menu - footer
  'menu.footer_archive': 'Archivo',
  'menu.footer_how_to_play': 'Cómo jugar',
  'menu.footer_settings_panel': 'Ajustes',

  // Settings panel
  'settings.skin_section': 'Skin',
  'settings.skin_active': 'Activo',
  'settings.skin_unlock': 'Desbloquear',
  'settings.restore_purchases': 'Restaurar compras',
  'settings.badge_free': 'Gratis',
  'settings.badge_owned': 'Comprado',
  'settings.purchase_in_progress': 'Comprando {name}...',
  'settings.purchase_not_unlocked': 'La compra no desbloqueó el skin',
  'settings.purchase_cancelled_or_unavailable': 'Compra cancelada o no disponible',
  'settings.restore_device_only': 'Restaurar disponible en dispositivos',
  'settings.restoring_purchases': 'Restaurando compras...',
  'settings.restore_failed': 'Falló la restauración',
  'settings.title': 'Ajustes',
  'settings.back': '← Menú',
  'settings.section_language': 'Idioma',
  'settings.section_skin': 'Skin',
  'settings.section_about': 'Acerca de',
  'settings.about_credit': 'Hecho en Chile',
  'settings.version': 'GlitchSalad v{version}',

  // Skin names - same in both languages
  'skin.void.name': 'Void',
  'skin.synthwave.name': 'Synthwave',
  'skin.gameboy.name': 'Game Boy',

  // Game view header
  'game.back': '← Menú',
  'game.day_label': 'Día {n}',
  'game.words_progress': '{found}/{total}',
  'game.instructions': 'Desliza letras adyacentes para encontrar todas las palabras.',
  'hint.out_title': 'Sin pistas',
  'hint.out_body': 'Ya usaste todas las pistas de hoy. Vuelve mañana para más.',
  'hint.out_close': 'Aceptar',

  // Win view
  'win.pristine_label': 'Impecable',
  'win.solved_subtitle': '¡Resuelto!',
  'win.new_best': 'Nuevo récord',
  'win.stat_day_streak': '🔥 Racha de {n} días',
  'win.stat_solved_count': '{n} resueltos',
  'win.stat_hint_one': '💡 {n} pista',
  'win.stat_hint_other': '💡 {n} pistas',
  'win.share_button': 'Compartir',
  'win.done_link': 'Listo',
  'win.new_rating': 'Nuevo nivel',
  'win.play_again': 'Jugar otra vez',

  // Share string
  'share.header': 'GlitchSalad #{day} — {title}',
  'share.line_pristine': '🏆 Impecable en {time}',
  'share.line_solved': 'Resuelto en {time}',
  'share.suffix_new_best': ' — NUEVO RÉCORD',
  'share.suffix_hint_one': ' · 💡 {n} pista',
  'share.suffix_hint_other': ' · 💡 {n} pistas',
  'share.stat_day_streak': '🔥 Racha de {n} días',
  'share.stat_solved_count': '{n} resueltos',
  'share.footer': 'glitchsalad.app',
  'share.pristine_in': 'Impecable en {time}',
  'share.solved_in': 'Resuelto en {time}',

  // Archive
  'archive.title': 'Archivo',
  'archive.back': '← Menú',
  'archive.empty': 'Vuelve mañana para tu primera entrada del archivo.',
  'archive.day_row': 'Día {n} — {title}',
  'archive.unsolved': '—',

  // How to play
  'how_to_play.title': 'Cómo jugar',
  'how_to_play.close': 'Saltar',
  'how_to_play.back': 'Atrás',
  'how_to_play.next': 'Siguiente',
  'how_to_play.got_it': 'Entendido',
  'how_to_play.step1_title': 'Forma palabras',
  'how_to_play.step1_body': 'Toca cada letra o desliza a través de ellas. La palabra se completa al llegar a una respuesta válida.',
  'how_to_play.step2_title': 'Sigue el tema',
  'how_to_play.step2_body': 'Cada puzzle diario tiene un tema. Todas las respuestas encajan.',
  'how_to_play.step3_title': 'Retrocede y reinicia',
  'how_to_play.step3_body': 'Toca la última letra para deshacer. Toca fuera del tablero para limpiar tu selección.',
  'how_to_play.step4_title': 'Ritual diario',
  'how_to_play.step4_body': 'Un puzzle nuevo cada día. Resuelve el de hoy para mantener tu racha.',

  // Common
  'common.cancel': 'Cancelar',

  // Dialogs
  'dialog.exit_title': '¿Salir del puzzle?',
  'dialog.exit_body': 'Si sales ahora, perderás el progreso actual.',
  'dialog.exit_confirm': 'Salir',
  'dialog.reset_progress_title': '¿Restablecer todo el progreso?',
  'dialog.reset_progress_body': 'Esto borrará puzzles resueltos, tiempos y racha.',
  'dialog.reset_progress_confirm': 'Restablecer',

  // Settings — web-only affordances
  'settings.web_only_skin_label': 'Disponible en iOS y Android',
  'settings.store_app_store': 'App Store',
  'settings.store_play_store': 'Google Play',
  'settings.privacy_policy': 'Política de privacidad',
  'settings.terms_of_service': 'Términos de servicio',

  // Menu — web-only CTA
  'menu.get_app_label': 'Descarga la app',
  'menu.yesterday_tag': 'AYER · DÍA {n}',
  'menu.yesterday_unsolved': 'Sin jugar',
  'menu.streak_loss': 'Tu racha de {n} días terminó. Resuelve el de hoy para empezar otra vez.',
  'menu.streak_loss_dismiss': 'Cerrar',
};
