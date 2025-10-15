from jinja2 import Environment, FileSystemLoader
import json

# Load JSON data
# with open('report/json/2024-05-31/Test-75fd8ed3.json', 'r') as file:
#     data = json.load(file)
with open('report/template/data.json', 'r') as file:
    data = json.load(file)

# Load Jinja2 template
env = Environment(loader=FileSystemLoader('.'))
template = env.get_template('report/template/template.html')

# Render the template with data
html_output = template.render(summary=data['summary'], chart=data['chart'], test_data=data['data'])

# Save the rendered HTML to a file
with open('report/html/check.html', 'w') as output_file:
    output_file.write(html_output)
    
print("HTML report generated successfully.")
