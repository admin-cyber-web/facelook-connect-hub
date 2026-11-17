import re
import json

# Read the file as text (UTF-8)
with open('src/components/ChatSystem.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Find all unique substrings containing mojibake characters
# Mojibake chars are in Latin-1 supplement range (0xC0-0xFF)
# but we want to find complete mojibake sequences (2-6 chars typically)
mojibake_char_set = set()
for ch in text:
    cp = ord(ch)
    if 0xC0 <= cp <= 0xFF:
        mojibake_char_set.add(ch)

print("Unique mojibake chars found:", sorted(mojibake_char_set, key=ord))
print("Count:", len(mojibake_char_set))

# Find all maximal runs of mojibake characters
# A mojibake sequence is a run of chars where each char is in 0xC0-0xFF range
# but we also need to handle cases like â¤ï¸ where some chars might be in 0x80-0xBF range
# when encoded as Windows-1252

# Let's find sequences that look like mojibake: runs of chars >= 0xC0
pattern = re.compile(r'[\u00C0-\u00FF]{2,}')
matches = pattern.findall(text)
unique_sequences = sorted(set(matches), key=len, reverse=True)

print("\nUnique mojibake sequences (2+ chars):")
for seq in unique_sequences:
    # Try to decode: encode as Windows-1252, then decode as UTF-8
    try:
        decoded = seq.encode('windows-1252').decode('utf-8')
        print(f"  {repr(seq)} -> {repr(decoded)} (U+{ord(decoded):04X})")
    except Exception as e:
        print(f"  {repr(seq)} -> DECODE FAILED: {e}")
