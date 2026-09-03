<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;800&family=Onest:wght@400;500;600;700&display=swap">
  <style>
    body { margin: 0; background: #1B0F52; color: #FFFFFF; font-family: Onest, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    h1, h2, h3 { font-family: Unbounded, Onest, system-ui, sans-serif; margin: 0; letter-spacing: -.035em; }
    p { margin: 0; }
  </style>
</helmet>

<div style="width: 1440px; background: #EFEAFF;">

  <!-- gradient screen -->
  <div style="position: relative; background: linear-gradient(128deg, #2B0F6B 0%, #4B2AD6 38%, #2A7FE0 72%, #2AABEE 100%); overflow: hidden;">
    <div style="position: absolute; right: -140px; top: 20px; width: 480px; height: 480px; border-radius: 999px; background: rgba(255,255,255,.07);"></div>
    <div style="position: absolute; left: -80px; bottom: 120px; width: 300px; height: 300px; border-radius: 999px; background: rgba(232,121,249,.16);"></div>

    <!-- nav -->
    <div style="position: relative; display: flex; align-items: center; gap: 22px; padding: 22px 60px;">
      <div style="display: flex; align-items: center; gap: 11px; flex: none;">
        <div style="width: 44px; height: 44px; border-radius: 15px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; overflow: hidden;">__DUCK_30__</div>
        <div style="display: grid; gap: 1px;">
          <span style="font-family: Unbounded, sans-serif; font-weight: 800; font-size: 19px; letter-spacing: .03em;">KIRA</span>
          <span style="font-size: 9.5px; letter-spacing: .16em; color: rgba(255,255,255,.72); white-space: nowrap;">БОТЫ · MINI APP · САЙТЫ</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 24px; font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,.88); white-space: nowrap;">
        <span>Как это работает</span><span>Тарифы</span><span>Отзывы</span><span>Почему так дёшево</span><span>Вопросы</span><span>О компании</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; margin-left: auto; flex: none;">
        <div style="display: flex; align-items: center; gap: 7px; padding: 10px 15px; border: 1.5px solid rgba(255,255,255,.5); border-radius: 999px; font-size: 13px; font-weight: 700; white-space: nowrap;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0 5 5L16 15l-3.5 3.5a2.1 2.1 0 0 1-3-3L13 12z"></path></svg>
          Бот под ключ
        </div>
        <div style="padding: 10px 16px; border-radius: 999px; background: rgba(255,255,255,.16); font-size: 13px; font-weight: 700;">Войти</div>
        <div style="padding: 12px 22px; border-radius: 999px; background: #FFD23F; color: #2B1B08; font-size: 13.5px; font-weight: 800; white-space: nowrap;">Создать бота</div>
      </div>
    </div>

    <!-- hero -->
    <div style="position: relative; display: grid; grid-template-columns: 1.04fr .96fr; gap: 40px; align-items: center; padding: 54px 60px 40px;">
      <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 22px;">
        <div style="display: flex; align-items: center; gap: 9px; padding: 9px 16px; border-radius: 999px; background: rgba(255,255,255,.16); font-size: 12px; font-weight: 700; letter-spacing: .07em;">
          <span style="width: 7px; height: 7px; border-radius: 999px; background: #FFD23F;"></span>
          РАБОТАЕТ ПРЯМО В TELEGRAM
        </div>
        <h1 style="font-size: 70px; line-height: .99; font-weight: 800;">Создай бота<br>и запусти его<br>за <span style="color: #FFD23F;">10 минут</span></h1>
        <p style="font-size: 19.5px; line-height: 1.6; color: rgba(255,255,255,.86); max-width: 34ch;">Без кода, без сервера и без похода к программисту. Берёте готовый сценарий, меняете тексты — уточка выходит на первую линию и отвечает клиентам.</p>

        <div style="display: flex; align-items: center; gap: 13px; margin-top: 2px;">
          <div style="display: flex; align-items: center; gap: 10px; padding: 19px 32px; border-radius: 999px; background: #FFD23F; color: #2B1B08; font-size: 17px; font-weight: 800; box-shadow: 0 18px 40px rgba(255,210,63,.3);">
            Создать бота бесплатно
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B1B08" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"></path></svg>
          </div>
          <div style="padding: 19px 28px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,.5); font-size: 16px; font-weight: 600;">Смотреть пример</div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 6px;">
          <span style="padding: 11px 18px; border-radius: 999px; background: rgba(255,255,255,.14); font-size: 13.5px; font-weight: 600;">Только бот · 350 ₽</span>
          <span style="padding: 11px 18px; border-radius: 999px; background: rgba(255,255,255,.14); font-size: 13.5px; font-weight: 600;">+ Mini App · 650 ₽</span>
          <span style="padding: 11px 18px; border-radius: 999px; background: #FFFFFF; color: #3B1FA8; font-size: 13.5px; font-weight: 800;">+ сайт · 650 ₽</span>
        </div>
      </div>

      <!-- duck + phone -->
      <div style="position: relative; height: 520px;">
        <div style="position: absolute; right: 6px; top: 0; width: 316px; border-radius: 36px; padding: 9px; background: rgba(255,255,255,.22); box-shadow: 0 40px 90px rgba(11,4,40,.45);">
          <div style="border-radius: 28px; overflow: hidden; background: #17161F;">
            <div style="display: flex; align-items: center; gap: 10px; padding: 13px 15px; background: linear-gradient(120deg, #2AABEE, #229ED9);">
              <div style="width: 30px; height: 30px; border-radius: 999px; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; overflow: hidden;">__DUCK_22__</div>
              <div style="display: grid;">
                <span style="font-size: 13px; font-weight: 700;">Салон «Мята»</span>
                <span style="font-size: 11px; color: rgba(255,255,255,.82);">бот · отвечает сразу</span>
              </div>
            </div>
            <div style="padding: 15px; display: flex; flex-direction: column; gap: 9px; background: #0F0E18;">
              <div style="max-width: 84%; padding: 10px 13px; border-radius: 16px 16px 16px 5px; background: #22212E; font-size: 13px; line-height: 1.45;">Здравствуйте! Записать вас или показать цены?</div>
              <div style="display: flex; gap: 7px;">
                <span style="flex: 1; text-align: center; padding: 9px 6px; border-radius: 11px; background: rgba(42,171,238,.2); color: #7DD3FC; font-size: 12px; font-weight: 600;">Записаться</span>
                <span style="flex: 1; text-align: center; padding: 9px 6px; border-radius: 11px; background: rgba(42,171,238,.2); color: #7DD3FC; font-size: 12px; font-weight: 600;">Цены</span>
              </div>
              <div style="align-self: flex-end; padding: 10px 13px; border-radius: 16px 16px 5px 16px; background: linear-gradient(120deg, #7C5CFF, #2AABEE); font-size: 13px;">Записаться</div>
              <div style="max-width: 84%; padding: 10px 13px; border-radius: 16px 16px 16px 5px; background: #22212E; font-size: 13px;">Как вас зовут?</div>
              <div style="align-self: flex-end; padding: 10px 13px; border-radius: 16px 16px 5px 16px; background: linear-gradient(120deg, #7C5CFF, #2AABEE); font-size: 13px;">Анна</div>
              <div style="max-width: 84%; padding: 10px 13px; border-radius: 16px 16px 16px 5px; background: #22212E; font-size: 13px; line-height: 1.45;">Записали, Анна! Перезвоним и подтвердим.</div>
            </div>
          </div>
        </div>

        <div style="position: absolute; left: 62px; bottom: -40px; z-index: 2; filter: drop-shadow(0 24px 40px rgba(11,4,40,.45));">__DUCK_268__</div>

        <div style="position: absolute; left: 66px; top: 26px; padding: 11px 15px; border-radius: 18px 18px 18px 6px; background: #FFFFFF; color: #2B0F6B; font-size: 13px; font-weight: 600; box-shadow: 0 16px 36px rgba(0,0,0,.3);">Я на связи 24/7 🐤</div>
        <div style="position: absolute; left: 0px; top: 132px; z-index: 3; padding: 10px 14px; border-radius: 18px 18px 6px 18px; background: #FFD23F; color: #2B1B08; font-size: 12.5px; font-weight: 700; box-shadow: 0 16px 36px rgba(0,0,0,.28);">+1 заявка</div>
      </div>
    </div>

    <!-- what you actually do: the constructor, not just the result -->
    <div style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; padding: 8px 60px 70px;">
      <div style="padding: 20px; border-radius: 22px; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.18);">
        <div style="display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 800; letter-spacing: .08em; color: rgba(255,255,255,.7);"><span style="width: 22px; height: 22px; border-radius: 7px; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 11px;">1</span>СОБИРАЕТЕ МЫШКОЙ</div>
        <div style="margin-top: 14px; display: grid; justify-items: center; gap: 0;">
          <div style="width: 100%; max-width: 240px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.9); color: #2B0F6B;">
            <div style="font-size: 9px; font-weight: 800; letter-spacing: .09em; color: #6D3BFF;">СООБЩЕНИЕ</div>
            <div style="margin-top: 4px; font-size: 11.5px; font-weight: 600; line-height: 1.4;">Записать вас или показать цены?</div>
            <div style="display: flex; gap: 5px; margin-top: 8px;"><span style="padding: 4px 8px; border-radius: 7px; background: #EFEAFF; font-size: 10px; font-weight: 700;">Записаться</span><span style="padding: 4px 8px; border-radius: 7px; background: #EFEAFF; font-size: 10px; font-weight: 700;">Цены</span></div>
          </div>
          <svg width="20" height="26" viewBox="0 0 20 26" style="stroke: #FFD23F; stroke-width: 2; stroke-dasharray: 4 4; fill: none;"><path d="M10 0 V26"></path></svg>
          <div style="display: flex; gap: 8px; width: 100%; max-width: 240px;">
            <div style="flex: 1; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,.75); color: #2B0F6B; font-size: 10.5px; font-weight: 700;">Вопрос: имя</div>
            <div style="flex: 1; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,.75); color: #2B0F6B; font-size: 10.5px; font-weight: 700;">Цены</div>
          </div>
        </div>
      </div>

      <div style="padding: 20px; border-radius: 22px; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.18);">
        <div style="display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 800; letter-spacing: .08em; color: rgba(255,255,255,.7);"><span style="width: 22px; height: 22px; border-radius: 7px; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 11px;">2</span>ПРОВЕРЯЕТЕ В ЧАТЕ</div>
        <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: rgba(15,14,24,.55);">
          <div style="max-width: 86%; padding: 8px 11px; border-radius: 13px 13px 13px 4px; background: #22212E; font-size: 11.5px;">Записать вас или показать цены?</div>
          <div style="align-self: flex-end; padding: 8px 11px; border-radius: 13px 13px 4px 13px; background: linear-gradient(120deg, #7C5CFF, #2AABEE); font-size: 11.5px;">Записаться</div>
          <div style="max-width: 86%; padding: 8px 11px; border-radius: 13px 13px 13px 4px; background: #22212E; font-size: 11.5px;">Как вас зовут?</div>
          <div style="align-self: flex-end; padding: 8px 11px; border-radius: 13px 13px 4px 13px; background: linear-gradient(120deg, #7C5CFF, #2AABEE); font-size: 11.5px;">Анна</div>
          <div style="max-width: 86%; padding: 8px 11px; border-radius: 13px 13px 13px 4px; background: #22212E; font-size: 11.5px;">Записали, Анна!</div>
        </div>
      </div>

      <div style="padding: 20px; border-radius: 22px; background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.18);">
        <div style="display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 800; letter-spacing: .08em; color: rgba(255,255,255,.7);"><span style="width: 22px; height: 22px; border-radius: 7px; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-size: 11px;">3</span>НАЖИМАЕТЕ «ЗАПУСТИТЬ»</div>
        <div style="margin-top: 14px; display: grid; justify-items: center; gap: 10px; padding: 16px 12px; border-radius: 14px; background: rgba(255,255,255,.1);">
          <div style="width: 74px; height: 74px; border-radius: 999px; background: rgba(255,255,255,.14); display: flex; align-items: center; justify-content: center;">__DUCK_54__</div>
          <div style="font-family: Unbounded, sans-serif; font-size: 15px; font-weight: 700;">Бот запущен</div>
          <div style="display: grid; gap: 6px; width: 100%; font-size: 11.5px;">
            <span style="display: flex; align-items: center; gap: 7px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD23F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Токен зашифрован</span>
            <span style="display: flex; align-items: center; gap: 7px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD23F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Кнопка меню настроена</span>
            <span style="display: flex; align-items: center; gap: 7px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD23F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Хостинг и HTTPS внутри</span>
          </div>
        </div>
      </div>
    </div>

    <!-- wave into the light half: the page has a bottom now -->
    <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style="display: block; width: 100%; height: 90px;">
      <path d="M0 46 C240 96 420 6 720 34 C1010 60 1200 96 1440 52 L1440 90 L0 90 Z" fill="#EFEAFF"></path>
    </svg>
  </div>

  <!-- light half -->
  <div style="background: #EFEAFF; color: #1A1140; padding: 26px 60px 60px;">
    <div style="display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px;">
      <div style="padding: 22px 24px; border-radius: 20px; background: rgba(255,255,255,.7);">
        <div style="font-family: Unbounded, sans-serif; font-size: 26px; font-weight: 700;">10 минут</div>
        <div style="margin-top: 6px; font-size: 13px; color: #6B5FA8;">от шаблона до живого бота</div>
      </div>
      <div style="padding: 22px 24px; border-radius: 20px; background: rgba(255,255,255,.7);">
        <div style="font-family: Unbounded, sans-serif; font-size: 26px; font-weight: 700;">350 ₽</div>
        <div style="margin-top: 6px; font-size: 13px; color: #6B5FA8;">в месяц, сколько бы ни писали</div>
      </div>
      <div style="padding: 22px 24px; border-radius: 20px; background: rgba(255,255,255,.7);">
        <div style="font-family: Unbounded, sans-serif; font-size: 26px; font-weight: 700;">0 строк</div>
        <div style="margin-top: 6px; font-size: 13px; color: #6B5FA8;">кода и настроек сервера</div>
      </div>
      <div style="padding: 22px 24px; border-radius: 20px; background: rgba(255,255,255,.7);">
        <div style="font-family: Unbounded, sans-serif; font-size: 26px; font-weight: 700;">24/7</div>
        <div style="margin-top: 6px; font-size: 13px; color: #6B5FA8;">отвечает ночью и в выходные</div>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 24px; margin-top: 22px; padding: 24px 30px; border-radius: 24px; background: linear-gradient(120deg, #2B0F6B, #2A7FE0); color: #FFFFFF;">
      <div style="flex: none; overflow: hidden;">__DUCK_92__</div>
      <div style="flex: 1;">
        <div style="font-size: 10.5px; font-weight: 800; letter-spacing: .14em; color: #C8BEFF;">НЕ ХОТИТЕ СОБИРАТЬ САМИ?</div>
        <h2 style="margin-top: 8px; font-size: 27px; font-weight: 800;">Соберём бота за вас — от 4 900 ₽</h2>
        <p style="margin-top: 7px; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,.85);">Вы рассказываете про своё дело, мы пишем сценарий, собираем и запускаем. Кабинет остаётся вам.</p>
      </div>
      <div style="flex: none; padding: 16px 26px; border-radius: 999px; background: #FFD23F; color: #2B1B08; font-size: 15px; font-weight: 800;">Посмотреть, что входит</div>
    </div>
  </div>

</div>
</x-dc>
</body>
</html>
