from google import genai

client = genai.Client(api_key="AIzaSyD-BGEP65uaxmcBx0j_DPNya5qNnJM-UV4")

models = client.models.list()

usable_models = []

for model in models:
    # Only consider models that support the method you want, e.g., image generation
    if "generateContent" in model.supported_actions:
        try:
            # Test if you can actually call the model
            client.generate_image(model=model.name, prompt="Test")
            usable_models.append(model.name)
        except Exception as e:
            # Skip models that fail due to permission, 404, or beta restriction
            continue

print("Models you can actually use:")
print(usable_models)
