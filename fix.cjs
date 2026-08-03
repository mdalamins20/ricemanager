const fs = require('fs');
let code = fs.readFileSync('g:/ricemanager/pages/MealEntry.tsx', 'utf8');

code = code.replace(
  '  const handleNextDay = () => {\n    const next = addDays(new Date(selectedDate), 1);\n    setSelectedDate(format(next, \'yyyy-MM-dd\'));\n  };',
  '  const handleNextDay = () => {\n    const todayStr = format(new Date(), \'yyyy-MM-dd\');\n    const next = addDays(new Date(selectedDate), 1);\n    const nextStr = format(next, \'yyyy-MM-dd\');\n    if (nextStr <= todayStr) {\n      setSelectedDate(nextStr);\n    }\n  };'
);

code = code.replace(
  '            <input\n              type="date"\n              value={selectedDate}\n              onChange={(e) => setSelectedDate(e.target.value)}',
  '            <input\n              type="date"\n              max={format(new Date(), \'yyyy-MM-dd\')}\n              value={selectedDate}\n              onChange={(e) => {\n                const todayStr = format(new Date(), \'yyyy-MM-dd\');\n                if (e.target.value <= todayStr) setSelectedDate(e.target.value);\n              }}'
);

code = code.replace(
  '          <button onClick={handleNextDay} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">\n            <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />\n          </button>',
  '          {selectedDate < format(new Date(), \'yyyy-MM-dd\') && (\n            <button onClick={handleNextDay} className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm">\n              <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />\n            </button>\n          )}'
);

fs.writeFileSync('g:/ricemanager/pages/MealEntry.tsx', code);
console.log('Fixed MealEntry');
