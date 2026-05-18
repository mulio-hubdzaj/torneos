from pathlib import Path
import re

path = Path('public/torneo_20260517_2216.sql')
backup = Path('public/torneo_20260517_2216.sql.bak')
if not backup.exists():
    backup.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')

keep = {'roles', 'usuarios'}
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
new_lines = []
current_table = None
in_copy = False
in_data = False
for line in lines:
    data_header = re.match(r'^--\s*Data for Name: ([^;]+);', line)
    if data_header:
        current_table = data_header.group(1).strip()
        in_copy = False
        in_data = False
        new_lines.append(line)
        continue
    if current_table:
        if line.startswith('COPY public.'):
            in_copy = True
            in_data = True
            new_lines.append(line)
            continue
        if in_data:
            if line == '\\.' or line == '\\.' + '\r':
                new_lines.append('\\.')
                current_table = None
                in_copy = False
                in_data = False
                continue
            if current_table in keep:
                new_lines.append(line)
            # skip data lines for other tables
            continue
    new_lines.append(line)

path.write_text('\n'.join(new_lines) + '\n', encoding='utf-8')
print('Cleanup complete for', path)
