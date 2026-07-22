const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/app/valet/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Fix the submit handler
const oldSubmitHandler = `  const handleCheckinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carNumber || !guestName || !guestPhone || !guestEmail) {
      alert('Please fill in all required fields (Car Number, Name, Phone, Email).');
      return;
    }`;
const newSubmitHandler = `  const handleCheckinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carNumber || !guestName || !guestPhone || !guestEmail) {
      alert('Please fill in all required fields (Car Number, Name, Phone, Email).');
      return;
    }
    if (!photoFront || !photoRear || !photoLeft || !photoRight || !photoDashboard) {
      alert('Please upload all 5 mandatory vehicle inspection photos.');
      return;
    }`;
content = content.replace(oldSubmitHandler, newSubmitHandler);

// 2. Fix the Form layout by extracting everything between <form onSubmit={handleCheckinSubmit} className="space-y-8"> and </form>
const formRegex = /<form onSubmit=\{handleCheckinSubmit\} className="space-y-8">([\s\S]*?)<\/form>/;

const newFormContent = `
                  {/* Step 1: Mandatory Information */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">1</span>
                      Mandatory Details
                    </h3>
                    
                    {isPrefilled && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md inline-block">
                        ✓ Occupant details loaded from active dining reservation.
                      </span>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-zinc-500">Guest Name *</label>
                        <input type="text" required value={guestName} onChange={(e) => setGuestName(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Phone Number *</label>
                        <input type="text" required value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-zinc-500">Email Address *</label>
                        <input type="email" required value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Car Number *</label>
                        <input type="text" required placeholder="e.g. KA-03-MR-9821" value={carNumber} onChange={(e) => setCarNumber(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 uppercase shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5 pt-2">
                      {[
                        { label: 'Front Angle *', file: photoFront, setter: setPhotoFront },
                        { label: 'Rear Angle *', file: photoRear, setter: setPhotoRear },
                        { label: 'Left Side *', file: photoLeft, setter: setPhotoLeft },
                        { label: 'Right Side *', file: photoRight, setter: setPhotoRight },
                        { label: 'Dashboard / Odo *', file: photoDashboard, setter: setPhotoDashboard }
                      ].map((inp, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-zinc-500">{inp.label}</span>
                          <label className="flex flex-col items-center justify-center border border-dashed border-zinc-200 hover:border-zinc-300 rounded-xl bg-zinc-50 h-28 cursor-pointer select-none transition-colors relative overflow-hidden">
                            {inp.file ? (
                              <div className="absolute inset-0 p-1 bg-white">
                                <img src={URL.createObjectURL(inp.file)} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                <span className="absolute bottom-1 right-1 rounded bg-zinc-950/80 px-1 text-[8px] font-bold text-white font-mono uppercase">Change</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <Plus className="h-5 w-5 text-zinc-400" />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Upload</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) inp.setter(f);
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Optional Information */}
                  <div className="space-y-4 pt-6 border-t border-zinc-100">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-500">2</span>
                      Optional Details
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Room Number</label>
                        <input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Brand / Make</label>
                        <input type="text" placeholder="e.g. Mercedes-Benz" value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Model</label>
                        <input type="text" placeholder="e.g. C-Class" value={model} onChange={(e) => setModel(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Color</label>
                        <input type="text" placeholder="e.g. Silver" value={color} onChange={(e) => setColor(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Parking Slot</label>
                        <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none">
                          <option value="">Select a Slot (Optional)</option>
                          {slots?.map(s => (
                            <option key={s._id} value={s.slotNumber} disabled={s.isOccupied}>
                              {s.slotNumber} {s.isOccupied ? '(Occupied)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Key Tag</label>
                        <input type="text" placeholder="e.g. K-104" value={keyTag} onChange={(e) => setKeyTag(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Fuel Level</label>
                        <select value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none">
                          <option value="Empty">Empty</option>
                          <option value="Quarter Tank">Quarter Tank</option>
                          <option value="Half Tank">Half Tank</option>
                          <option value="Three Quarter">Three Quarter</option>
                          <option value="Full Tank">Full Tank</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-zinc-500">Odometer (Optional)</label>
                        <input type="number" placeholder="Current mileage" value={odometer} onChange={(e) => setOdometer(e.target.value)} className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 shadow-inner focus:border-brand focus:bg-white focus:outline-none" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 pt-2">
                      <span className="text-xs font-bold text-zinc-500">Damage Photos (Optional)</span>
                      <div className="flex flex-wrap gap-4 items-center">
                        {photoDamageList.map((file, idx) => (
                          <div key={idx} className="relative h-20 w-20 border border-zinc-200 bg-white rounded-xl p-0.5 shrink-0 overflow-hidden">
                            <img src={URL.createObjectURL(file)} alt="Damage preview" className="w-full h-full object-cover rounded-lg" />
                            <button type="button" onClick={() => setPhotoDamageList(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold font-mono focus:outline-none">×</button>
                          </div>
                        ))}
                        {photoDamageList.length < 5 && (
                          <label className="flex flex-col items-center justify-center border border-dashed border-zinc-200 hover:border-zinc-300 rounded-xl bg-zinc-50 h-20 w-20 cursor-pointer select-none transition-colors">
                            <Plus className="h-4 w-4 text-zinc-400" />
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Damage</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoDamageList(prev => [...prev, f]); }} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-6 border-t border-zinc-100 flex justify-end gap-3">
                    <button type="button" onClick={() => setActiveTab('queue')} className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100">
                      Cancel
                    </button>
                    <button type="submit" disabled={checkinMutation.isPending} className="rounded-xl bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-zinc-800 active:scale-95 disabled:opacity-75">
                      {checkinMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking-In Vehicle…
                        </span>
                      ) : (
                        'Complete Check-In'
                      )}
                    </button>
                  </div>
`;

content = content.replace(formRegex, '<form onSubmit={handleCheckinSubmit} className="space-y-8">' + newFormContent + '</form>');

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated valet page form layout and validation logic.');
