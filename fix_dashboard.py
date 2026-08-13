import sys

path = sys.argv[1]
with open(path, 'r') as f:
    lines = f.readlines()

# Find the first occurrence of "  }, []);\n" that is followed by "    if (flowResult.status"
# We want to keep the first one (clean function end) and remove everything
# from the second "  }, []);" up to and including the next "  }, []);"

clean = []
i = 0
while i < len(lines):
    # Look for the broken duplicate block pattern
    if (i + 1 < len(lines) and 
        lines[i].strip() == '}, []);' and 
        lines[i+1].strip().startswith('if (flowResult.status === \'fulfilled\') setFlows(flowResult.value);')):
        # Skip until we find the closing "  }, []);" of the duplicate
        while i < len(lines) and not (lines[i].strip() == '}, []);' and i > 0):
            i += 1
        if i < len(lines):
            i += 1  # skip the closing }, []);
        continue
    clean.append(lines[i])
    i += 1

with open(path, 'w') as f:
    f.writelines(clean)

print('Fixed duplicate code block')
