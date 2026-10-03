from pathlib import Path
import json,copy
R=Path(__file__).resolve().parents[2]
P=R/'resource_packs/rp_22_392fe57f-87d4-4146-a8ba-5c548001ab45/ui/server_form.json'
d=json.loads(P.read_text('utf-8-sig'))
visible=d.get('pinene_cooking_long_form',d.get('pinene_cooking_long_form@common_dialogs.main_panel_no_buttons'))['bindings']
# Do not inherit a dialog with an inset, shorter child area.
u={'namespace':'server_form','long_form':d['long_form'],'main_screen_content':d['main_screen_content']}
u['pinene_cooking_long_form']={'type':'panel','size':[398,236],'anchor_from':'center','anchor_to':'center','layer':2,'bindings':visible,'controls':[{'content@server_form.pinene_cooking_content':{}}]}
def rect(name,x,y,w,h,color,layer=0):
 return {name:{'type':'image','texture':'textures/ui/White','anchor_from':'top_left','anchor_to':'top_left','offset':[x,y],'size':[w,h],'color':color,'layer':layer}}
def label(name,text,x,y,w,h,scale=1):
 return {name:{'type':'label','text':text,'anchor_from':'top_left','anchor_to':'top_left','offset':[x,y],'size':[w,h],'color':[0.20,0.20,0.20],'shadow':False,'font_scale_factor':scale,'layer':6}}
def bevel(name,x,y,w,h,fill,inner=False):
 light,dark=[0.98]*3,[0.28]*3
 if inner: light,dark=dark,light
 return [rect(name+'_shadow',x,y,w,h,dark),rect(name+'_light',x,y,w-1,h-1,light,1),rect(name+'_fill',x+1,y+1,w-2,h-2,fill,2)]
def holder(name,x,y,w,h,controls):
 return {name:{'type':'collection_panel','collection_name':'form_buttons','anchor_from':'top_left','anchor_to':'top_left','offset':[x,y],'size':[w,h],'controls':controls}}
def slot(name,index,x,y,w=22,h=22,template='pinene_counted_slot'):
 return {name+'@server_form.'+template:{'collection_index':index,'anchor_from':'top_left','anchor_to':'top_left','offset':[x,y],'size':[w,h]}}
c=[]
c+=bevel('frame',0,0,398,236,[0.77]*3)
c.append(label('title','料理台',10,10,140,15,1.15))
c+=bevel('recipes',8,48,151,178,[0.34]*3,True)
c+=bevel('craft',168,8,222,105,[0.77]*3,True)
c+=bevel('inventory',168,118,222,108,[0.77]*3,True)
c.append(holder('rank_tabs',8,29,151,16,[slot('rank_'+str(i),i,0 if i==0 else 29+(i-1)*17,0,28 if i==0 else 16,16,'pinene_tab_button') for i in range(8)]))
c.append(holder('recipe_grid',15,53,140,151,[slot('recipe_'+str(i),8+i,(i%4)*35,(i//4)*30,28,28,'pinene_recipe_slot') for i in range(20)]))
c.append(holder('page_controls',15,208,136,15,[slot('prev',75,0,0,22,14,'pinene_tab_button'),slot('number',76,31,0,72,14,'pinene_tab_button'),slot('next',77,113,0,22,14,'pinene_tab_button')]))
c.append(label('crafting_label','クラフト',177,16,72,12,.85))
c.append(holder('ingredient_grid',190,36,72,72,[slot('ingredient_'+str(i),28+i,(i%3)*24,(i//3)*24,22,22) for i in range(9)]))
# Draw a pixel arrow; the Minecraft font does not reliably provide the arrow glyph.
c += [rect('arrow_bar',274,64,12,6,[.48]*3,4)]
for j,height in enumerate([22,18,14,10,6]): c.append(rect('arrow_tip_'+str(j),286+j*2,67-height//2,2,height,[.48]*3,4))
n=label('result_name','#form_text',300,23,72,24,.8)
n['result_name']['bindings']=[{'binding_name':'#form_text'}]
n['result_name']['text_alignment']='center';c.append(n)
c.append(holder('result',318,52,34,34,[slot('item',37,0,0,34,34,'pinene_result_slot')]))
c.append(holder('craft_button',304,90,66,18,[slot('craft',38,0,0,66,18,'pinene_craft_button')]))
c.append(label('inventory_label','インベントリ',175,120,170,10,.78))
c.append(holder('inventory_grid',175,132,207,66,[slot('inventory_'+str(i),39+i,(i%9)*23,(i//9)*22,22,21) for i in range(27)]))
c.append(holder('hotbar_grid',175,203,207,21,[slot('hotbar_'+str(i),66+i,i*23,0,22,21) for i in range(9)]))
c.append(holder('close',377,9,11,11,[slot('close',78,0,0,11,11,'pinene_tab_button')]))
u['pinene_cooking_content']={'type':'panel','size':['100%','100%'],'controls':c}
def binding(name,target=None):
 b={'binding_name':name,'binding_type':'collection','binding_collection_name':'form_buttons'}
 if target:b['binding_name_override']=target
 return b
def view(expr,target):return {'binding_type':'view','source_property_name':expr,'target_property_name':target}
def face(recipe=False,result=False):
 out=[rect('slot_dark',0,0,'100%','100%',[.24]*3,1),rect('slot_light',1,1,'100% - 1px','100% - 1px',[.94]*3,2),rect('slot_fill',1,1,'100% - 2px','100% - 2px',[.54]*3,3)]
 if recipe:
  a=rect('selected',0,0,'100%','100%',[.60,.83,.94],4)
  a['selected']['bindings']=[binding('#form_button_text'),view("(not ((#form_button_text - '§a') = #form_button_text))",'#visible')]
  out += [a,rect('selected_inner',2,2,'100% - 4px','100% - 4px',[.54]*3,5)]
 out.append({'icon':{'type':'image','size':['100% - 5px','100% - 5px'],'anchor_from':'center','anchor_to':'center','keep_ratio':True,'layer':6,'bindings':[binding('#form_button_texture','#texture'),binding('#form_button_texture_file_system','#texture_file_system'),view("(not ((#texture = '') or (#texture = 'loading')))",'#visible')]}})
 if not recipe:
  out.append({'count':{'type':'label','text':'#form_button_text','anchor_from':'bottom_right','anchor_to':'bottom_right','offset':[-1,-1],'layer':8,'shadow':True,'font_scale_factor':.64 if not result else .83,'bindings':[binding('#form_button_text')]}})
 return {'type':'panel','size':['100%','100%'],'controls':out}
u['pinene_recipe_face']=face(True);u['pinene_counted_face']=face();u['pinene_result_face']=face(result=True)
for kind in ['recipe','counted','result']:
 u['pinene_'+kind+'_slot@common_buttons.light_content_button']={'$pressed_button_name':'button.form_button_click','$button_text':'#null','$button_text_binding_type':'collection','$button_text_grid_collection_name':'form_buttons','$button_content':'server_form.pinene_'+kind+'_face','size':[22,22],'bindings':[{'binding_type':'collection_details','binding_collection_name':'form_buttons'}]}
for kind in ['tab','craft']:
 cc=[rect('fill',1,1,'100% - 2px','100% - 2px',[.72]*3,2)]
 a=rect('selected',1,1,'100% - 2px','100% - 2px',[.33,.58,.22] if kind=='craft' else [.90]*3,3)
 a['selected']['bindings']=[binding('#form_button_text'),view("(not ((#form_button_text - '§a') = #form_button_text))",'#visible')];cc.append(a)
 cc.append({'label':{'type':'label','text':'#form_button_text','anchor_from':'center','anchor_to':'center','size':['100% - 2px','100% - 2px'],'text_alignment':'center','color':[.2]*3,'shadow':False,'font_scale_factor':.78 if kind=='craft' else .70,'layer':6,'bindings':[binding('#form_button_text')]}})
 u['pinene_'+kind+'_face']={'type':'panel','size':['100%','100%'],'controls':cc}
 u['pinene_'+kind+'_button@common_buttons.light_content_button']={'$pressed_button_name':'button.form_button_click','$button_text':'#null','$button_text_binding_type':'collection','$button_text_grid_collection_name':'form_buttons','$button_content':'server_form.pinene_'+kind+'_face','size':[22,16],'bindings':[{'binding_type':'collection_details','binding_collection_name':'form_buttons'}]}
for key in ['pinene_tab_face','pinene_craft_face']:
 lbl=u[key]['controls'][-1]['label'];lbl['text']='#display_text'
 lbl['bindings'].append(view("(#form_button_text - '§a')",'#display_text'))
P.write_text(json.dumps(u,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('UI_WRITTEN',P,'size=398x236','recipes=20','inventory=27+9','form_buttons=79')
# Navigation captions do not depend on collection text propagating into nested controls.
for kind,text in [('previous','<'),('next','>'),('close','x')]:
 face=copy.deepcopy(u['pinene_tab_face'])
 face['controls'][-1]['label']['text']=text
 face['controls'][-1]['label']['bindings']=[]
 u['pinene_'+kind+'_face']=face
 button=copy.deepcopy(u['pinene_tab_button@common_buttons.light_content_button'])
 button['$button_content']='server_form.pinene_'+kind+'_face'
 u['pinene_'+kind+'_button@common_buttons.light_content_button']=button
for wrapper in u['pinene_cooking_content']['controls']:
 if 'close' in wrapper:
  c=wrapper['close']['controls'][0]
  value=c.pop('close@server_form.pinene_tab_button');c['close@server_form.pinene_close_button']=value
 if 'page_controls' in wrapper:
  h=wrapper['page_controls']
  h['bindings']=[{'binding_name':'#title_text'},view("(not (#title_text = 'pinene_cooking_ui:1 / 1'))",'#visible')]
  c=h['controls'][0];value=c.pop('prev@server_form.pinene_tab_button');c['prev@server_form.pinene_previous_button']=value
  c=h['controls'][2];value=c.pop('next@server_form.pinene_tab_button');c['next@server_form.pinene_next_button']=value
  # Body is reserved for the recipe name; title carries page metadata.
  label=copy.deepcopy(u['pinene_tab_face'])
  label['controls'][-1]['label']['text']='#page_text'
  label['controls'][-1]['label']['bindings']=[{'binding_name':'#title_text'},view("(#title_text - 'pinene_cooking_ui:')",'#page_text')]
  u['pinene_page_face']=label
  b=copy.deepcopy(u['pinene_tab_button@common_buttons.light_content_button']);b['$button_content']='server_form.pinene_page_face'
  u['pinene_page_button@common_buttons.light_content_button']=b
  c=h['controls'][1];value=c.pop('number@server_form.pinene_tab_button');c['number@server_form.pinene_page_button']=value
P.write_text(json.dumps(u,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
