const fs = require('fs');
let code = fs.readFileSync('g:/ricemanager/pages/Members.tsx', 'utf8');

code = code.replace(
  ""fullName: '', phone: '', address: '', status: 'active'"",
  ""fullName: '', phone: '', address: '', status: 'active', photoBase64: ''""
);

code = code.replace(
  ""{ fullName: '', phone: '', address: '', status: 'active' }"",
  ""{ fullName: '', phone: '', address: '', status: 'active', photoBase64: '' }""
);

const uploadFn = \  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, photoBase64: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit\;
code = code.replace(""  const handleSubmit"", uploadFn);

const formUploadUI = \<form onSubmit={handleSubmit} className=\\"space-y-4\\">
              <div className=\\"flex flex-col items-center gap-3 mb-4\\">
                 <div className=\\"relative h-24 w-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800 overflow-hidden group\\">
                    {formData.photoBase64 ? (
                        <img src={formData.photoBase64} alt=\\"Avatar\\" className=\\"h-full w-full object-cover\\" />
                    ) : (
                        <UserPlus className=\\"h-8 w-8 text-slate-400 group-hover:scale-110 transition-transform\\" />
                    )}
                    <input type=\\"file\\" accept=\\"image/*\\" onChange={handleImageUpload} className=\\"absolute inset-0 opacity-0 cursor-pointer\\" title=\\"Upload Photo\\" />
                 </div>
                 <span className=\\"text-xs font-bold text-slate-500 uppercase tracking-widest\\">Profile Photo</span>
              </div>
              <input type=\\"text\\"\;
code = code.replace('<form onSubmit={handleSubmit} className=\\"space-y-4\\">\\r\\n              <input type=\\"text\\"', formUploadUI);
// Fallback for \\n
code = code.replace('<form onSubmit={handleSubmit} className=\\"space-y-4\\">\\n              <input type=\\"text\\"', formUploadUI);

const gridAvatar = \<div className={\\\h-16 w-16 rounded-2xl flex items-center justify-center font-black text-2xl relative \\\\\\}>
                      {member.photoBase64 ? (
                         <img src={member.photoBase64} alt={member.fullName} className=\\"h-full w-full object-cover rounded-2xl\\" />
                      ) : (
                         member.fullName.charAt(0)
                      )}
                      {/* Active Pulse */}\;
code = code.replace(
  \<div className={\\\h-16 w-16 rounded-2xl flex items-center justify-center font-black text-2xl relative \\\\\\}>\\r\\n                      {member.fullName.charAt(0)}\\r\\n                      {/* Active Pulse */}\,
  gridAvatar
);
code = code.replace(
  \<div className={\\\h-16 w-16 rounded-2xl flex items-center justify-center font-black text-2xl relative \\\\\\}>\\n                      {member.fullName.charAt(0)}\\n                      {/* Active Pulse */}\,
  gridAvatar
);

const modalAvatar = \<div className=\\"h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold overflow-hidden shrink-0\\">
                {member.photoBase64 ? (
                   <img src={member.photoBase64} alt={member.fullName} className=\\"h-full w-full object-cover\\" />
                ) : (
                   member.fullName.charAt(0)
                )}
             </div>\;
code = code.replace(
  \<div className=\\"h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold\\">\\r\\n                {member.fullName.charAt(0)}\\r\\n             </div>\,
  modalAvatar
);
code = code.replace(
  \<div className=\\"h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold\\">\\n                {member.fullName.charAt(0)}\\n             </div>\,
  modalAvatar
);

fs.writeFileSync('g:/ricemanager/pages/Members.tsx', code);
console.log('Done');
