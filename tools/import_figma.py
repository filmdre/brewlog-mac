"""Convert inspected Figma layers into the website's editable design specification.

Reads API responses downloaded with geometry=paths from the specified cache.
Outputs an apply_patch patch, so generated changes remain reviewable.
"""
import json
import sys
from pathlib import Path

FILES = {
    'journal': 'K9P0oVIdl6hR4TpXTomfIO',
    'cafes': 'HIHWOwlwyZskL9XSWnpy6N',
    'log': 'l6qbUQTJ32KyRfnpYVqaf9',
    'activity': '1lPKqbmRVswcHhgRItbFXD',
    'lists': 'zqCDzqxNvB9mPENmuFKW04',
}

def color(paints):
    for p in paints or []:
        if p.get('visible', True) and p.get('type') == 'SOLID':
            c=p['color']
            return 'rgba(%s,%s,%s,%s)' % (round(c['r']*255),round(c['g']*255),round(c['b']*255),round(c.get('a',1)*p.get('opacity',1),4))
    return None

def font(s):
    props={'fontFamily':s.get('fontFamily'),'fontSize':s.get('fontSize'),'fontWeight':s.get('fontWeight'),
           'lineHeight':s.get('lineHeightPx'),'letterSpacing':s.get('letterSpacing'),
           'textTransform':{'UPPER':'uppercase','LOWER':'lowercase','TITLE':'capitalize'}.get(s.get('textCase')),
           'textAlign':s.get('textAlignHorizontal','LEFT').lower(),'fontStyle':'italic' if s.get('italic') else None}
    if color(s.get('fills')):props['color']=color(s['fills'])
    return {k:v for k,v in props.items() if v is not None}

def convert(n,parent):
    b=n.get('absoluteBoundingBox')
    if not b or not n.get('visible',True): return None
    styles={'left':round(b['x']-parent['x'],4),'top':round(b['y']-parent['y'],4),'width':b['width'],'height':b['height']}
    c=color(n.get('fills'))
    if c:styles['color' if n['type']=='TEXT' else 'background']=c
    if n.get('opacity') is not None: styles['opacity']=n['opacity']
    if n.get('cornerRadius'):styles['borderRadius']=n['cornerRadius']
    if n.get('rectangleCornerRadii'):styles['borderRadius']=' '.join(str(x)+'px' for x in n['rectangleCornerRadii'])
    if n['type']=='ELLIPSE':styles['borderRadius']='50%'
    stroke=color(n.get('strokes'))
    if stroke and n['type'] not in ['VECTOR','BOOLEAN_OPERATION']:
        styles['borderStyle']='solid';styles['borderColor']=stroke
        weights=n.get('individualStrokeWeights')
        styles['borderWidth']=' '.join(str(weights[k])+'px' for k in ['top','right','bottom','left']) if weights else str(n.get('strokeWeight',1))+'px'
    result={'id':n['id'],'name':n['name'],'type':n['type'],'s':styles}
    if n['type']=='TEXT':
        styles.update(font(n['style']))
        text=n.get('characters',''); ids=n.get('characterStyleOverrides',[]); runs=[]
        for i,ch in enumerate(text):
            sid=str(ids[i]) if i<len(ids) else '0'
            if runs and runs[-1]['key']==sid:runs[-1]['text']+=ch
            else:runs.append({'key':sid,'text':ch,'s':font(n.get('styleOverrideTable',{}).get(sid,{}))})
        result['text']=text;result['runs']=runs
    if n['type'] in {'VECTOR','BOOLEAN_OPERATION','LINE','ELLIPSE','RECTANGLE'} and (n.get('fillGeometry') or n.get('strokeGeometry')):
        result['paths']=[{'d':p['path'],'fill':color(n.get(paint)) or 'transparent','rule':'evenodd' if p.get('windingRule')=='EVENODD' else 'nonzero'} for field,paint in [('fillGeometry','fills'),('strokeGeometry','strokes')] for p in n.get(field,[])]
        result['view']=[n.get('size',{}).get('x',b['width']),n.get('size',{}).get('y',b['height'])]
        styles.pop('background',None); styles.pop('borderWidth',None)
    result['children']=[c for child in n.get('children',[]) if (c:=convert(child,b))]
    return result

data={}
for route,key in FILES.items():
    source=json.loads((Path(sys.argv[1])/('figma-paths-'+key+'.json')).read_text())
    frame=source['document']['children'][0]['children'][0]
    b=frame['absoluteBoundingBox']; data[route]=convert(frame,b)
    data[route]['source']={'file':key,'node':frame['id'],'name':source['name']}
payload='// Generated from Figma layers by tools/import_figma.py.\nconst FIGMA_DESIGNS = '+json.dumps(data,separators=(',',':'),ensure_ascii=False)+';\n'
print('*** Begin Patch\n*** Add File: /Users/andrervizu/Documents/Codex/2026-11-09/i-x20/design-spec.js')
for line in payload.splitlines():print('+'+line)
print('*** End Patch')
