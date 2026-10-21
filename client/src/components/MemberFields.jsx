import Field from './Field';

// One player's form block. `prefix` is the react-hook-form path, e.g. members.0
export default function MemberFields({ register, errors, prefix, index, isCaptain, label, optional }) {
  const e = prefix.split('.').reduce((o, k) => o?.[k], errors) || {};
  const path = (k) => `${prefix}.${k}`;
  return (
    <fieldset className="member-block">
      <h6>
        <span>{label || `Player ${index + 1}`}{isCaptain && <span className="chip chip-confirmed ms-2">Captain</span>}{optional && <span className="text-muted fw-normal ms-2">(optional)</span>}</span>
      </h6>
      <div className="row g-2">
        <Field className="col-12 col-sm-6" label="Full name" autoComplete="off" {...register(path('name'), optional ? {} : { required: 'Enter the player\'s name', minLength: { value: 2, message: 'Name is too short' } })} error={e.name} />
        <Field className="col-12 col-sm-6" label="In-game username" autoComplete="off" {...register(path('inGameName'), optional ? {} : { required: 'Enter the in-game username' })} error={e.inGameName} />
        <Field className="col-12 col-sm-6" label="Player ID" autoComplete="off" hint="The unique ID shown in the game profile" {...register(path('playerId'), optional ? {} : { required: 'Enter the player ID', pattern: { value: /^[A-Za-z0-9_\-#.]{3,40}$/, message: 'Use 3–40 letters, numbers or _ - # .' } })} error={e.playerId} />
        <Field className="col-12 col-sm-6" label={isCaptain ? 'Phone or email' : 'Phone or email (optional)'} autoComplete="off" {...register(path('contact'), isCaptain ? { required: 'Captain contact is required' } : {})} error={e.contact} />
      </div>
    </fieldset>
  );
}
