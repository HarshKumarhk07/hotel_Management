const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
console.log('Str0ng!Pass', regex.test('Str0ng!Pass'));
