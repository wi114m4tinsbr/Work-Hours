import { test, expect } from '@playwright/test';
const initial = { production: true, tokenReady: true, databaseReady: true, connected: false, enabled: false, opened: true, accepted: true, messages: true, replies: false };
for (const language of ['pt','en','es']) test(`notification preferences ${language} work on mobile`, async ({page}, testInfo) => {
  let state = { ...initial }; let saved: any;
  await page.setViewportSize({width:390,height:844});
  await page.route('**/fixture/*',async route=>{
    const action=route.request().url().split('/').pop();
    if(action==='pair') { state.connected=true; await route.fulfill({json:{url:'https://t.me/ShiftHoursAvisoBot?start=example'}});return; }
    if(action==='save'){saved=route.request().postDataJSON();state={...state,...saved};}
    if(action==='disconnect') state={...initial};
    await route.fulfill({json:state});
  });
  await page.goto(`/tests/notifications.html?lang=${language}${language==='en'?'&dark':''}`);
  const panel=page.getByTestId('support-notifications');
  await expect(panel.getByRole('checkbox').first()).toBeDisabled();
  await panel.getByRole('button',{name:{pt:'Conectar meu Telegram',en:'Connect my Telegram',es:'Conectar mi Telegram'}[language]}).click();
  await expect(panel.getByRole('link')).toHaveAttribute('href',/t.me/);
  await panel.getByRole('button',{name:{pt:'Atualizar',en:'Refresh',es:'Actualizar'}[language],exact:true}).click();
  await panel.getByRole('checkbox').first().check();
  await panel.getByRole('checkbox').last().check();
  await panel.getByRole('button',{name:{pt:'Salvar preferências',en:'Save preferences',es:'Guardar preferencias'}[language]}).click();
  await expect.poll(()=>saved?.replies).toBe(true);
  expect(saved.language).toBe(language);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`notifications-${language}.png`),fullPage:true});
});
test('preview and missing configuration keep controls disabled',async({page})=>{
  await page.route('**/fixture/*',route=>route.fulfill({json:{...initial,production:false}}));
  await page.goto('/tests/notifications.html');
  await expect(page.getByText(/O preview não envia avisos/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Conectar meu Telegram'})).toBeDisabled();
});
