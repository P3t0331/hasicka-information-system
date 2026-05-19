import React, { useState } from 'react';
import AddressInput from '../AddressInput';

export default function RegisterForm({ onSubmit, loading }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      firstName,
      lastName,
      phone,
      address,
      email,
      password
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="input-group">
        <label className="input-label">Jméno</label>
        <input 
          className="input-field" 
          type="text" 
          required 
          value={firstName} 
          onChange={e => setFirstName(e.target.value)} 
        />
      </div>

      <div className="input-group">
        <label className="input-label">Příjmení</label>
        <input 
          className="input-field" 
          type="text" 
          required 
          value={lastName} 
          onChange={e => setLastName(e.target.value)} 
        />
      </div>

      <div className="input-group">
        <label className="input-label">Telefon (+420)</label>
        <input 
          className="input-field" 
          type="tel" 
          required 
          value={phone} 
          onChange={e => setPhone(e.target.value)} 
          placeholder="777 123 456"
        />
      </div>

      <AddressInput 
        value={address} 
        onChange={setAddress} 
        required={true} 
      />

      <div className="input-group">
        <label className="input-label">Email</label>
        <input 
          className="input-field" 
          type="email" 
          required 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
        />
      </div>

      <div className="input-group">
        <label className="input-label">Heslo</label>
        <input 
          className="input-field" 
          type="password" 
          required 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        />
      </div>

      <button disabled={loading} className="btn btn-primary w-full" type="submit">
        Zaregistrovat se
      </button>
    </form>
  );
}
