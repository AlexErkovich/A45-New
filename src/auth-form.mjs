export function mountAuthForm({root,client,service,current=()=>true,onSuccess}){
 root.innerHTML=`<section class="auth-shell" aria-label="Вход администратора"><div class="auth-art"><img class="auth-logo" src="assets/logo.png" alt="A45" width="1536" height="1024"></div><div class="auth-panel"><a class="auth-back" href="/#/">Вернуться на сайт</a><div class="admin-page admin-login"><form id="admin-login-form"><label for="auth-email">Электронная почта</label><input id="auth-email" name="email" type="email" autocomplete="username" placeholder="you@example.com" required><label for="auth-password">Пароль</label><input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="Введите пароль" required><button class="primary ui-button ui-button--primary" type="submit">Войти</button><p role="status" data-admin-status data-feedback-inline aria-live="polite"></p></form></div></div></section>`;
 const form=root.querySelector('form'),button=form.querySelector('button'),message=root.querySelector('[data-admin-status]');
 const show=text=>{message.textContent=text;message.classList.add('error')};
 form.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');message.classList.remove('error');message.textContent='Проверяем вход…';
  try{const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(!current())return;
   if(error){show('Не удалось войти. Проверьте email и пароль');return}
   if(!await service.isAdmin()){if(current())show('У этой учётной записи нет прав администратора.');return}
   if(current())await onSuccess();
  }catch(error){if(current())show('Не удалось проверить доступ. '+(error.message||'Проверьте соединение.'))}
  finally{form.elements.password.value='';if(current()){button.disabled=false;button.removeAttribute('aria-busy')}}
 });
}
