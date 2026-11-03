import sys

content = open("C:\\Users\\hello\\Documents\\facelook-connect-hub\\src\\components\\UserProfilePreviewModal.tsx").read()

# Replace About Me heading - font weight and color
old_about = '<h2 id="ppm-about-title" className="text-[13px] font-black text-[color:#37494c]">About Me</h2>'
new_about = '<h2 id="ppm-about-title" className="text-[13px] font-semibold text-[color:#ff0000]">About Me</h2>'
content = content.replace(old_about, new_about)

# Replace Last Activity heading - font weight and color
old_activity = '<h2 id="ppm-activity-title" className="text-[13px] font-black text-[color:#37494c]">Last Activity</h2>'
new_activity = '<h2 id="ppm-activity-title" className="text-[13px] font-semibold text-[color:#ff0000]">Last Activity</h2>'
content = content.replace(old_activity, new_activity)

# Replace stats text colors from #42565a to #facc15 (lemon yellow)
old_stat = 'text-[color:#42565a]'
new_stat = 'text-[color:#facc15]'
content = content.replace(old_stat, new_stat)

# Replace the lighter gray text in stat labels
old_label = 'text-[color:#9aa5a6]'
new_label = 'text-[color:#facc15]'
content = content.replace(old_label, new_label)

# Replace bio text color
old_bio = 'text-[color:#69777a]'
new_bio = 'text-[color:#facc15]'
content = content.replace(old_bio, new_bio)

# Replace activity text colors
old_activity_text = 'text-[color:#536468]'
new_activity_text = 'text-[color:#facc15]'
content = content.replace(old_activity_text, new_activity_text)

# Replace section labels like "Posts", "Friends", etc.
old_labels = 'text-[color:#9aa5a6]'
new_labels = 'text-[color:#facc15]'
content = content.replace(old_labels, new_labels)

# Replace "See all" button text color
old_seeall = 'text-[color:#0d9695]'
new_seeall = 'text-[color:#ff0000]'
content = content.replace(old_seeall, new_seeall)

# Replace "No recent public activity" text
old_noactivity = 'text-[color:#8d9a9b]'
new_noactivity = 'text-[color:#ff0000]'
content = content.replace(old_noactivity, new_noactivity)

# Replace "Last Seen" text color
old_lastseen = 'text-[color:#a6b0af]'
new_lastseen = 'text-[color:#ff0000]'
content = content.replace(old_lastseen, new_lastseen)

# Replace profile info text colors
old_profile = 'text-[color:#aab4b3]'
new_profile = 'text-[color:#ff0000]'
content = content.replace(old_profile, new_profile)

# Replace activity badge background colors
old_badge_bg = '#e4f6ef'
new_badge_bg = '#ff0000'

# Replace container background
old_container = 'bg-[color:#eff3f2]'
new_container = 'bg-[color:#0a0a0a]'

# Replace font weights - make them semibold/bold
old_font_black = 'font-black'
new_font_black = 'font-semibold'

content = content.replace(old_font_black, new_font_black)

open("C:\\Users\\hello\\Documents\\facelook-connect-hub\\src\\components\\UserProfilePreviewModal.tsx", "w").write(content)
print("Styling replacement done!")