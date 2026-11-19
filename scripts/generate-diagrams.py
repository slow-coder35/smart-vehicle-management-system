from pathlib import Path
import re,html,subprocess
root=Path(__file__).resolve().parents[1]
out=root/'docs/diagrams'
out.mkdir(parents=True, exist_ok=True)
sql=(root/'db/migrations/001_core.sql').read_text()
tables={}
for m in re.finditer(r'CREATE TABLE (\w+) \((.*?)\);',sql,re.S):
 name,body=m.groups(); chunks=[];start=0;depth=0;quoted=False
 for i,c in enumerate(body):
  if c=="'":quoted=not quoted
  if not quoted:
   if c=='(':depth+=1
   elif c==')':depth-=1
   elif c==',' and depth==0:chunks.append(body[start:i].strip());start=i+1
 chunks.append(body[start:].strip())
 cols=[]
 for chunk in chunks:
  match=re.match(r'(\w+)\s+(uuid|text|boolean|timestamptz|integer|numeric\(\d+,\d+\)|date)(.*)',chunk,re.S)
  if not match: continue
  col,typ,rest=match.groups(); ref=re.search(r'REFERENCES (\w+)\((\w+)\)',rest)
  cols.append(dict(name=col,type=typ,pk='PRIMARY KEY' in rest,uk='UNIQUE' in rest,required='NOT NULL' in rest or 'PRIMARY KEY' in rest,ref=ref.groups() if ref else None))
 tables[name]=cols
assert len(tables)==12
verbs={'owner_id':'owns','centre_id':'assigned staff' ,'user_id':'has sessions','vehicle_id':'has','slot_id':'receives','requested_service_type_id':'requested for','booking_id':'has','completed_by':'completes','record_id':'contains','service_type_id':'classifies','fault_code':'tags','actor_id':'records changes'}
logical=[('bookings','id','job_inspections','booking_id','0..1'),('vehicles','id','job_inspections','vehicle_id','0..N'),('service_centres','id','job_inspections','centre_id','0..N'),('users','id','job_inspections','updated_by','0..N')]
mongo=[('_id','ObjectId','PK'),('booking_id','UUID string','UK, REF'),('vehicle_id','UUID string','REF'),('centre_id','UUID string','REF'),('updated_by','UUID string','REF'),('revision','integer',''),('diagnostic_notes','string (optional)',''),('created_at','date',''),('updated_at','date',''),('items[]','embedded objects',''),('items[].component','string',''),('items[].result','PASS / ATTENTION / FAIL',''),('items[].comment','string',''),('items[].measurements[]','name, value, unit','')]
for detailed,stem,title in [(False,'er-diagram','Entity Relationship Diagram'),(True,'relational-schema','Relational Schema Diagram')]:
 lines=['digraph G {','graph [rankdir=LR, bgcolor="#ffffff", pad="0.4", nodesep="0.5", ranksep="1.1", splines=polyline, fontname="DejaVu Sans", label="SMART VEHICLE SERVICE AND MAINTENANCE INTELLIGENCE SYSTEM\\n'+title+'\\nSolid lines: SQL foreign keys | Dashed lines: application references to MongoDB", labelloc=t, fontsize=22];','node [shape=plain, fontname="DejaVu Sans"];','edge [fontname="DejaVu Sans", fontsize=10, color="#89798d", arrowsize=0.65];']
 for name,cols in tables.items():
  selected=cols if detailed else [c for c in cols if c['pk']]
  rows=['<TR><TD COLSPAN="3" BGCOLOR="#713d79"><FONT COLOR="white"><B>'+name+'</B></FONT></TD></TR>']
  for c in selected:
   flags=', '.join(k for k,ok in [('PK',c['pk']),('FK',c['ref']),('UK',c['uk'])] if ok)
   typ=c['type']+(' NULL' if not c['required'] else '') if detailed else ''
   rows.append(f'<TR><TD ALIGN="LEFT">{flags}</TD><TD PORT="{c["name"]}" ALIGN="LEFT">{c["name"]}</TD><TD ALIGN="LEFT">{html.escape(typ)}</TD></TR>')
  lines.append(name+' [label=<<TABLE BORDER="0" CELLBORDER="1" COLOR="#e0d4e3" CELLSPACING="0" CELLPADDING="7">'+''.join(rows)+'</TABLE>>];')
 rows=['<TR><TD COLSPAN="3" BGCOLOR="#a45c41"><FONT COLOR="white"><B>job_inspections (MongoDB)</B></FONT></TD></TR>']
 for name,typ,flags in (mongo if detailed else mongo[:5]):
  rows.append(f'<TR><TD ALIGN="LEFT">{flags}</TD><TD PORT="{name}" ALIGN="LEFT">{html.escape(name)}</TD><TD ALIGN="LEFT">{html.escape(typ) if detailed else ""}</TD></TR>')
 lines.append('job_inspections [label=<<TABLE BORDER="0" CELLBORDER="1" COLOR="#ecd4c6" CELLSPACING="0" CELLPADDING="7">'+''.join(rows)+'</TABLE>>];')
 for child,cols in tables.items():
  for c in cols:
   if not c['ref']:continue
   parent,key=c['ref'];count='0..1' if c['uk'] else '0..N';pcount='1' if c['required'] else '0..1'
   label=c['name'] if detailed else verbs.get(c['name'],'has')
   if child=='service_slots':label='publishes slots' if not detailed else label
   if child=='users' and not detailed:label='employs (STAFF only)'
   lines.append(f'{parent} -> {child} [label="{label} ({pcount} : {count})"];' if not detailed else f'{parent}:{key}:e -> {child}:{c["name"]}:w;')
 for parent,key,child,col,count in logical:
  lines.append(f'{parent} -> {child} [style=dashed, color="#bb795a", label="{col} (1 : {count})"];' if not detailed else f'{parent}:{key}:e -> {child}:{col}:w [style=dashed, color="#bb795a"];')
 lines.append('}')
 dot=out/(stem+'.dot');dot.write_text('\n'.join(lines))
 for fmt in ('svg','png'):subprocess.run(['dot','-T'+fmt,str(dot),'-o',str(out/(stem+'.'+fmt))],check=True)
# Editable Mermaid version with exact optionality and all SQL columns.
mer=['erDiagram']
for name,cols in tables.items():
 mer.append('    '+name+' {')
 for c in cols:
  flags=', '.join(k for k,ok in [('PK',c['pk']),('FK',c['ref']),('UK',c['uk'])] if ok)
  mer.append('        '+c['type'].replace('numeric(12,2)','decimal')+' '+c['name']+(' '+flags if flags else ''))
 mer.append('    }')
for child,cols in tables.items():
 for c in cols:
  if c['ref']:mer.append(f'    {c["ref"][0]} '+('||' if c['required'] else '|o')+('--o|' if c['uk'] else '--o{')+f' {child} : "{c["name"]}"')
(out/'relational-schema.mmd').write_text('\n'.join(mer)+'\n')
print('Generated diagrams for',len(tables),'tables and',sum(bool(c['ref']) for cs in tables.values() for c in cs),'SQL foreign keys.')
