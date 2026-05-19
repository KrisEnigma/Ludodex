export const strings = {
  // Menu - top bar / chrome
  'menu.day_chip': 'Day {n}',
  'menu.settings_aria': 'Settings',
  'menu.brand_glitch': 'GLITCH',
  'menu.brand_salad': 'SALAD',

  // Menu - stats
  'menu.stat_streak': 'Streak',
  'menu.stat_solved': 'Solved',
  'menu.stat_best': 'Best',
  'menu.stat_empty': '--',

  // Menu - daily card
  'menu.daily_tag_today': 'TODAY',
  'menu.daily_next_in': 'NEXT IN {time}',
  'menu.daily_play': '▶ Play',
  'menu.daily_play_again': '✓ Solved · Play again',

  // Menu - footer
  'menu.footer_archive': 'Archive',
  'menu.footer_how_to_play': 'How to play',
  'menu.footer_settings_panel': 'Settings',

  // Settings panel
  'settings.skin_section': 'Skin',
  'settings.skin_active': 'Active',
  'settings.skin_unlock': 'Unlock',
  'settings.restore_purchases': 'Restore purchases',
  'settings.badge_free': 'Free',
  'settings.badge_owned': 'Owned',
  'settings.purchase_in_progress': 'Purchasing {name}...',
  'settings.purchase_not_unlocked': 'Purchase did not unlock skin',
  'settings.purchase_cancelled_or_unavailable': 'Purchase cancelled or unavailable',
  'settings.restore_device_only': 'Restore available on device builds',
  'settings.restoring_purchases': 'Restoring purchases...',
  'settings.restore_failed': 'Restore failed',
  'settings.title': 'Settings',
  'settings.back': '← Menu',
  'settings.section_language': 'Language',
  'settings.section_skin': 'Skin',
  'settings.section_about': 'About',
  'settings.about_credit': 'By KrisEnigma',
  'settings.version': 'GlitchSalad v{version}',

  // Skin display names
  'skin.void.name': 'Void',
  'skin.synthwave.name': 'Synthwave',
  'skin.gameboy.name': 'Game Boy',

  // Game view header
  'game.back': '← Menu',
  'game.day_label': 'Day {n}',
  'game.words_progress': '{found}/{total}',
  'game.instructions': 'Swipe adjacent letters to find all words.',
  'hint.out_title': 'No hints left',
  'hint.out_body': 'You have used all hints for today. Come back tomorrow for more.',
  'hint.out_close': 'OK',

  // Win view
  'win.pristine_label': 'Pristine',
  'win.solved_subtitle': 'Puzzle solved',
  'win.new_best': 'New best',
  'win.stat_day_streak': '🔥 Day {n} streak',
  'win.stat_solved_count': '{n} solved',
  'win.stat_hint_one': '💡 {n} hint',
  'win.stat_hint_other': '💡 {n} hints',
  'win.share_button': 'Share',
  'win.done_link': 'Done',
  'win.new_rating': 'New rating',
  'win.play_again': 'Play again',

  // Share string
  'share.header': 'GlitchSalad #{day} — {title}',
  'share.line_pristine': '🏆 Pristine in {time}',
  'share.line_solved': 'Solved {time}',
  'share.suffix_new_best': ' — NEW BEST',
  'share.suffix_hint_one': ' · 💡 {n} hint',
  'share.suffix_hint_other': ' · 💡 {n} hints',
  'share.stat_day_streak': '🔥 Day {n} streak',
  'share.stat_solved_count': '{n} solved',
  'share.footer': 'glitchsalad.app',
  'share.pristine_in': 'Pristine in {time}',
  'share.solved_in': 'Solved in {time}',

  // Archive
  'archive.title': 'Archive',
  'archive.back': '← Menu',
  'archive.empty': 'Come back tomorrow for the first archive entry.',
  'archive.day_row': 'Day {n} — {title}',
  'archive.unsolved': '—',

  // How to play
  'how_to_play.title': 'How to play',
  'how_to_play.close': 'Skip',
  'how_to_play.back': 'Back',
  'how_to_play.next': 'Next',
  'how_to_play.got_it': 'Got it',
  'how_to_play.step1_title': 'Form words',
  'how_to_play.step1_body': 'Tap each letter or swipe across them. The word completes when you reach a valid answer.',
  'how_to_play.step2_title': 'Stick to the theme',
  'how_to_play.step2_body': 'Each daily puzzle has a theme. All the answers fit it.',
  'how_to_play.step3_title': 'Backtrack and restart',
  'how_to_play.step3_body': 'Tap the last letter to undo. Tap outside the grid to clear your selection.',
  'how_to_play.step4_title': 'Daily ritual',
  'how_to_play.step4_body': 'A new puzzle every day. Solve today\'s to build your streak.',

  // Common
  'common.cancel': 'Cancel',

  // Dialogs
  'dialog.exit_title': 'Leave puzzle?',
  'dialog.exit_body': 'Your current progress will be lost if you leave now.',
  'dialog.exit_confirm': 'Leave',
  'dialog.reset_progress_title': 'Reset all progress?',
  'dialog.reset_progress_body': 'This will clear solved puzzles, times, and streak data.',
  'dialog.reset_progress_confirm': 'Reset',

  // Settings — web-only affordances
  'settings.web_only_skin_label': 'Available on iOS / Android',
  'settings.store_app_store': 'App Store',
  'settings.store_play_store': 'Google Play',
  'settings.privacy_policy': 'Privacy policy',
  'settings.terms_of_service': 'Terms of service',

  // Menu — web-only CTA
  'menu.get_app_label': 'Get the app',
  'menu.yesterday_tag': 'YESTERDAY · DAY {n}',
  'menu.yesterday_unsolved': 'Not played',
  'menu.streak_loss': 'Your {n}-day streak ended. Solve today to start fresh.',
  'menu.streak_loss_dismiss': 'Dismiss',
} as const;
