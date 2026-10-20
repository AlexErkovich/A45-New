export function mountAuthForm({root,client,service,current=()=>true,onSuccess}){
 root.innerHTML=`<section class="admin-page admin-login"><h1>Вход администратора</h1><p>Публичная регистрация отключена.</p><form id="admin-login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Войти</button><p role="status" data-admin-status aria-live="polite"></p></form><p><a href="/#/">Вернуться на сайт</a></p></section>`;
 const form=root.querySelector('form'),button=form.querySelector('button'),message=root.querySelector('[data-admin-status]');
 const show=text=>{message.textContent=text;message.classList.add('error')};
 form.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled)return;button.disabled=true;message.textContent='Проверяем вход…';
  try{const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(!current())return;
   if(error){show(error.code==='email_not_confirmed'?'Email не подтверждён в Supabase Authentication.':'Не удалось войти. Проверьте email и пароль.');return}
   if(!await service.isAdmin()){if(current())show('У этой учётной записи нет прав администратора.');return}
   if(current())await onSuccess();
  }catch(error){if(current())show('Не удалось проверить доступ. '+(error.message||'Проверьте соединение.'))}
  finally{form.elements.password.value='';if(current())button.disabled=false}
 });
}
