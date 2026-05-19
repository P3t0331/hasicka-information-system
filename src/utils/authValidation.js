export function validatePhone(phone) {
  const phoneRegex = /^(\+420)? ?[1-9][0-9]{2} ?[0-9]{3} ?[0-9]{3}$/;
  if (!phoneRegex.test(phone)) {
    return 'Neplatný formát telefonního čísla. Použijte např. 777 123 456 nebo +420 777 123 456';
  }
  return null;
}

export function validatePassword(password) {
  const passwordErrors = [];
  if (password.length < 8) passwordErrors.push("minimálně 8 znaků");
  if (!/[A-Z]/.test(password)) passwordErrors.push("velké písmeno");
  if (!/[a-z]/.test(password)) passwordErrors.push("malé písmeno");
  if (!/[0-9]/.test(password)) passwordErrors.push("číslici");

  if (passwordErrors.length > 0) {
    return "Heslo musí obsahovat: " + passwordErrors.join(", ") + ".";
  }
  return null;
}
