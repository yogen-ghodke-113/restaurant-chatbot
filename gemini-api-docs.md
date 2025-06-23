Grounding with Google Search

Grounding with Google Search connects the Gemini model to real-time web content and works with all available languages. This allows Gemini to provide more accurate answers and cite verifiable sources beyond its knowledge cutoff.

Grounding helps you build applications that can:

Increase factual accuracy: Reduce model hallucinations by basing responses on real-world information.
Access real-time information: Answer questions about recent events and topics.
Provide citations: Build user trust by showing the sources for the model's claims.

Python
JavaScript
REST

from google import genai
from google.genai import types

# Configure the client

client = genai.Client()

# Define the grounding tool

grounding_tool = types.Tool(
google_search=types.GoogleSearch()
)

# Configure generation settings

config = types.GenerateContentConfig(
tools=[grounding_tool]
)

# Make the request

response = client.models.generate_content(
model="gemini-2.5-flash",
contents="Who won the euro 2024?",
config=config,
)

# Print the grounded response

print(response.text)
You can learn more by trying the Search tool notebook.

How grounding with Google Search works
When you enable the google_search tool, the model handles the entire workflow of searching, processing, and citing information automatically.

grounding-overview

User Prompt: Your application sends a user's prompt to the Gemini API with the google_search tool enabled.
Prompt Analysis: The model analyzes the prompt and determines if a Google Search can improve the answer.
Google Search: If needed, the model automatically generates one or multiple search queries and executes them.
Search Results Processing: The model processes the search results, synthesizes the information, and formulates a response.
Grounded Response: The API returns a final, user-friendly response that is grounded in the search results. This response includes the model's text answer and groundingMetadata with the search queries, web results, and citations.
Understanding the Grounding Response
When a response is successfully grounded, the response includes a groundingMetadata field. This structured data is essential for verifying claims and building a rich citation experience in your application.

{
"candidates": [
{
"content": {
"parts": [
{
"text": "Spain won Euro 2024, defeating England 2-1 in the final. This victory marks Spain's record fourth European Championship title."
}
],
"role": "model"
},
"groundingMetadata": {
"webSearchQueries": [
"UEFA Euro 2024 winner",
"who won euro 2024"
],
"searchEntryPoint": {
"renderedContent": "<!-- HTML and CSS for the search widget -->"
},
"groundingChunks": [
{"web": {"uri": "https://vertexaisearch.cloud.google.com.....", "title": "aljazeera.com"}},
{"web": {"uri": "https://vertexaisearch.cloud.google.com.....", "title": "uefa.com"}}
],
"groundingSupports": [
{
"segment": {"startIndex": 0, "endIndex": 85, "text": "Spain won Euro 2024, defeatin..."},
"groundingChunkIndices": [0]
},
{
"segment": {"startIndex": 86, "endIndex": 210, "text": "This victory marks Spain's..."},
"groundingChunkIndices": [0, 1]
}
]
}
}
]
}
The Gemini API returns the following information with the groundingMetadata:

webSearchQueries : Array of the search queries used. This is useful for debugging and understanding the model's reasoning process.
searchEntryPoint : Contains the HTML and CSS to render the required Search Suggestions. Full usage requirements are detailed in the Terms of Service.
groundingChunks : Array of objects containing the web sources (uri and title).
groundingSupports : Array of chunks to connect model response text to the sources in groundingChunks. Each chunk links a text segment (defined by startIndex and endIndex) to one or more groundingChunkIndices. This is the key to building inline citations.
Grounding with Google Search can also be used in combination with the URL context tool to ground responses in both public web data and the specific URLs you provide.

Attributing Sources with inline Citations
The API returns structured citation data, giving you complete control over how you display sources in your user interface. You can use the groundingSupports and groundingChunks fields to link the model's statements directly to their sources. Here is a common pattern for processing the metadata to create a response with inline, clickable citations.

Python
JavaScript

def add_citations(response):
text = response.text
supports = response.candidates[0].grounding_metadata.grounding_supports
chunks = response.candidates[0].grounding_metadata.grounding_chunks

    # Sort supports by end_index in descending order to avoid shifting issues when inserting.
    sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)

    for support in sorted_supports:
        end_index = support.segment.end_index
        if support.grounding_chunk_indices:
            # Create citation string like [1](link1)[2](link2)
            citation_links = []
            for i in support.grounding_chunk_indices:
                if i < len(chunks):
                    uri = chunks[i].web.uri
                    citation_links.append(f"[{i + 1}]({uri})")

            citation_string = ", ".join(citation_links)
            text = text[:end_index] + citation_string + text[end_index:]

    return text

# Assuming response with grounding metadata

text_with_citations = add_citations(response)
print(text_with_citations)

Spain won Euro 2024, defeating England 2-1 in the final.[1](https:/...), [2](https:/...), [4](https:/...), [5](https:/...) This victory marks Spain's record-breaking fourth European Championship title.[5]((https:/...), [2](https:/...), [3](https:/...), [4](https:/...)
Pricing
When you use Grounding with Google Search, your project is billed per API request that includes the google_search tool. If the model decides to execute multiple search queries to answer a single prompt (for example, searching for "UEFA Euro 2024 winner" and "Spain vs England Euro 2024 final score" within the same API call), this counts as a single billable use of the tool for that request.

For detailed pricing information, see the Gemini API pricing page.

Supported Models
Experimental and Preview models are not included. You can find their capabilities on the model overview page.

Model Grounding with Google Search
Gemini 2.5 Pro ✔️
Gemini 2.5 Flash ✔️
Gemini 2.0 Flash ✔️
Gemini 1.5 Pro ✔️
Gemini 1.5 Flash ✔️
Note: Older models use a google_search_retrieval tool. For all current models, use the google_search tool as shown in the examples.
Grounding with Gemini 1.5 Models (Legacy)
While the google_search tool is recommended for Gemini 2.0 and later, Gemini 1.5 support a legacy tool named google_search_retrieval. This tool provides a dynamic mode that allows the model to decide whether to perform a search based on its confidence that the prompt requires fresh information. If the model's confidence is above a dynamic_threshold you set (a value between 0.0 and 1.0), it will perform a search.

Python
JavaScript
REST

# Note: This is a legacy approach for Gemini 1.5 models.

# The 'google_search' tool is recommended for all new development.

import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

retrieval_tool = types.Tool(
google_search_retrieval=types.GoogleSearchRetrieval(
dynamic_retrieval_config=types.DynamicRetrievalConfig(
mode=types.DynamicRetrievalConfigMode.MODE_DYNAMIC,
dynamic_threshold=0.7 # Only search if confidence > 70%
)
)
)

config = types.GenerateContentConfig(
tools=[retrieval_tool]
)

response = client.models.generate_content(
model='gemini-1.5-flash',
contents="Who won the euro 2024?",
config=config,
)
print(response.text)
if not response.candidates[0].grounding_metadata:
print("\nModel answered from its own knowledge.")
What's next
Try the Grounding with Google Search in the Gemini API Cookbook.
Learn about other available tools, like Function Calling.
Learn how to augment prompts with specific URLs using the URL context tool.
Was this helpful?

Home
Gemini API
Models
Was this helpful?

Send feedbackGemini thinking

The Gemini 2.5 series models use an internal "thinking process" that significantly improves their reasoning and multi-step planning abilities, making them highly effective for complex tasks such as coding, advanced mathematics, and data analysis.

This guide shows you how to work with Gemini's thinking capabilities using the Gemini API.

Before you begin
Ensure you use a supported 2.5 series model for thinking. You might find it beneficial to explore these models in AI Studio before diving into the API:

Try Gemini 2.5 Flash in AI Studio
Try Gemini 2.5 Pro in AI Studio
Try Gemini 2.5 Flash-Lite Preview in AI Studio
Generating content with thinking
Initiating a request with a thinking model is similar to any other content generation request. The key difference lies in specifying one of the models with thinking support in the model field, as demonstrated in the following text generation example:

Python
JavaScript
Go
REST

from google import genai

client = genai.Client(api_key="GOOGLE_API_KEY")
prompt = "Explain the concept of Occam's Razor and provide a simple, everyday example."
response = client.models.generate_content(
model="gemini-2.5-pro",
contents=prompt
)

print(response.text)
Thinking budgets
The thinkingBudget parameter guides the model on the number of thinking tokens to use when generating a response. A higher token count generally allows for more detailed reasoning, which can be beneficial for tackling more complex tasks. If latency is more important, use a lower budget or disable thinking by setting thinkingBudget to 0. Setting the thinkingBudget to -1 turns on dynamic thinking, meaning the model will adjust the budget based on the complexity of the request.

The thinkingBudget is only supported in Gemini 2.5 Flash, 2.5 Pro, and 2.5 Flash-Lite. Depending on the prompt, the model might overflow or underflow the token budget.

The following are thinkingBudget configuration details for each model type.

Model Default setting
(Thinking budget is not set) Range Disable thinking Turn on dynamic thinking
2.5 Pro Dynamic thinking: Model decides when and how much to think 128 to 32768 N/A: Cannot disable thinking thinkingBudget = -1
2.5 Flash Dynamic thinking: Model decides when and how much to think 0 to 24576 thinkingBudget = 0 thinkingBudget = -1
2.5 Flash Lite Model does not think 512 to 24576 thinkingBudget = 0 thinkingBudget = -1
Python
JavaScript
Go
REST

from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
model="gemini-2.5-pro",
contents="Provide a list of 3 famous physicists and their key contributions",
config=types.GenerateContentConfig(
thinking_config=types.ThinkingConfig(thinking_budget=1024) # Turn off thinking: # thinking_config=types.ThinkingConfig(thinking_budget=0) # Turn on dynamic thinking: # thinking_config=types.ThinkingConfig(thinking_budget=-1)
),
)

print(response.text)
Thought summaries (Experimental)
Thought summaries are synthisized versions of the model's raw thoughts and offer insights into the model's internal reasoning process. Note that thinking budgets apply to the model's raw thoughts and not to thought summaries.

You can enable thought summaries by setting includeThoughts to true in your request configuration. You can then access the summary by iterating through the response parameter's parts, and checking the thought boolean.

Here's an example demonstrating how to enable and retrieve thought summaries without streaming, which returns a single, final thought summary with the response:

Python
JavaScript
Go

from google import genai
from google.genai import types

client = genai.Client(api_key="GOOGLE_API_KEY")
prompt = "What is the sum of the first 50 prime numbers?"
response = client.models.generate_content(
model="gemini-2.5-pro",
contents=prompt,
config=types.GenerateContentConfig(
thinking_config=types.ThinkingConfig(
include_thoughts=True
)
)
)

for part in response.candidates[0].content.parts:
if not part.text:
continue
if part.thought:
print("Thought summary:")
print(part.text)
print()
else:
print("Answer:")
print(part.text)
print()

And here is an example using thinking with streaming, which returns rolling, incremental summaries during generation:

Python
JavaScript
Go

from google import genai
from google.genai import types

client = genai.Client(api_key="GOOGLE_API_KEY")

prompt = """
Alice, Bob, and Carol each live in a different house on the same street: red, green, and blue.
The person who lives in the red house owns a cat.
Bob does not live in the green house.
Carol owns a dog.
The green house is to the left of the red house.
Alice does not own a cat.
Who lives in each house, and what pet do they own?
"""

thoughts = ""
answer = ""

for chunk in client.models.generate_content_stream(
model="gemini-2.5-pro",
contents=prompt,
config=types.GenerateContentConfig(
thinking_config=types.ThinkingConfig(
include_thoughts=True
)
)
):
for part in chunk.candidates[0].content.parts:
if not part.text:
continue
elif part.thought:
if not thoughts:
print("Thoughts summary:")
print(part.text)
thoughts += part.text
else:
if not answer:
print("Thoughts summary:")
print(part.text)
answer += part.text
Pricing
Note: Summaries are available in the free and paid tiers of the API.
When thinking is turned on, response pricing is the sum of output tokens and thinking tokens. You can get the total number of generated thinking tokens from the thoughtsTokenCount field.

Python
JavaScript
Go

# ...

print("Thoughts tokens:",response.usage_metadata.thoughts_token_count)
print("Output tokens:",response.usage_metadata.candidates_token_count)
Thinking models generate full thoughts to improve the quality of the final response, and then output summaries to provide insight into the thought process. So, pricing is based on the full thought tokens the model needs to generate to create a summary, despite only the summary being output from the API.

You can learn more about tokens in the Token counting guide.

Supported Models
You can find all model capabilities on the model overview page.

Model Thinking summaries Thinking budget
Gemini 2.5 Flash ✔️ ✔️
Gemini 2.5 Pro ✔️ ✔️
Gemini 2.5 Flash Lite ✔️ ✔️
Best practices
This section includes some guidance for using thinking models efficiently. As always, following our prompting guidance and best practices will get you the best results.

Debugging and steering
Review reasoning: When you're not getting your expected response from the thinking models, it can help to carefully analyze Gemini's thought summaries. You can see how it broke down the task and arrived at its conclusion, and use that information to correct towards the right results.

Provide Guidance in Reasoning: If you're hoping for a particularly lengthy output, you may want to provide guidance in your prompt to constrain the amount of thinking the model uses. This lets you reserve more of the token output for your response.

Task complexity
Easy Tasks (Thinking could be OFF): For straightforward requests where complex reasoning isn't required, such as fact retrieval or classification, thinking is not required. Examples include:
"Where was DeepMind founded?"
"Is this email asking for a meeting or just providing information?"
Medium Tasks (Default/Some Thinking): Many common requests benefit from a degree of step-by-step processing or deeper understanding. Gemini can flexibly use thinking capability for tasks like:
Analogize photosynthesis and growing up.
Compare and contrast electric cars and hybrid cars.
Hard Tasks (Maximum Thinking Capability): For truly complex challenges, such as solving complex math problems or coding tasks, we recommend setting a high thinking budget. These types of tasks require the model needs to engage its full reasoning and planning capabilities, often involving many internal steps before providing an answer. Examples include:
Solve problem 1 in AIME 2025: Find the sum of all integer bases b > 9 for which 17b is a divisor of 97b.
Write Python code for a web application that visualizes real-time stock market data, including user authentication. Make it as efficient as possible.
Thinking with tools and capabilities
Thinking models work with all of Gemini's tools and capabilities. This allows the models to interact with external systems, execute code, or access real-time information, incorporating the results into their reasoning and final response.

The search tool allows the model to query Google Search to find up-to-date information or information beyond its training data. This is useful for questions about recent events or highly specific topics.

The code execution tool enables the model to generate and run Python code to perform calculations, manipulate data, or solve problems that are best handled algorithmically. The model receives the code's output and can use it in its response.

With structured output, you can constrain Gemini to respond with JSON. This is particularly useful for integrating the model's output into applications.

Function calling connects the thinking model to external tools and APIs, so it can reason about when to call the right function and what parameters to provide.

URL Context provides the model with URLs as additional context for your prompt. The model can then retrieve content from the URLs and use that content to inform and shape its response.

You can try examples of using tools with thinking models in the Thinking cookbook.

What's next?
To work through more in depth examples, like:

Using tools with thinking
Streaming with thinking
Adjusting the thinking budget for different results
and more, try our Thinking cookbook.

Thinking coverage is now available in our OpenAI Compatibility guide.

For more info about Gemini 2.5 Pro, Gemini Flash 2.5, and Gemini 2.5 Flash-Lite, visit the model page.

Structured output

You can configure Gemini for structured output instead of unstructured text, allowing precise extraction and standardization of information for further processing. For example, you can use structured output to extract information from resumes, standardize them to build a structured database.

Gemini can generate either JSON or enum values as structured output.

Generating JSON
There are two ways to generate JSON using the Gemini API:

Configure a schema on the model
Provide a schema in a text prompt
Configuring a schema on the model is the recommended way to generate JSON, because it constrains the model to output JSON.

Configuring a schema (recommended)
To constrain the model to generate JSON, configure a responseSchema. The model will then respond to any prompt with JSON-formatted output.

Python
JavaScript
Go
REST

from google import genai
from pydantic import BaseModel

class Recipe(BaseModel):
recipe_name: str
ingredients: list[str]

client = genai.Client(api_key="GOOGLE_API_KEY")
response = client.models.generate_content(
model="gemini-2.5-flash",
contents="List a few popular cookie recipes, and include the amounts of ingredients.",
config={
"response_mime_type": "application/json",
"response_schema": list[Recipe],
},
)

# Use the response as a JSON string.

print(response.text)

# Use instantiated objects.

my_recipes: list[Recipe] = response.parsed
Note: Pydantic validators are not yet supported. If a pydantic.ValidationError occurs, it is suppressed, and .parsed may be empty/null.
The output might look like this:

[
{
"recipeName": "Chocolate Chip Cookies",
"ingredients": [
"1 cup (2 sticks) unsalted butter, softened",
"3/4 cup granulated sugar",
"3/4 cup packed brown sugar",
"1 teaspoon vanilla extract",
"2 large eggs",
"2 1/4 cups all-purpose flour",
"1 teaspoon baking soda",
"1 teaspoon salt",
"2 cups chocolate chips"
]
},
...
]
Providing a schema in a text prompt
Instead of configuring a schema, you can supply a schema as natural language or pseudo-code in a text prompt. This method is not recommended, because it might produce lower quality output, and because the model is not constrained to follow the schema.

Warning: Don't provide a schema in a text prompt if you're configuring a responseSchema. This can produce unexpected or low quality results.
Here's a generic example of a schema provided in a text prompt:

List a few popular cookie recipes, and include the amounts of ingredients.

Produce JSON matching this specification:

Recipe = { "recipeName": string, "ingredients": array<string> }
Return: array<Recipe>
Since the model gets the schema from text in the prompt, you might have some flexibility in how you represent the schema. But when you supply a schema inline like this, the model is not actually constrained to return JSON. For a more deterministic, higher quality response, configure a schema on the model, and don't duplicate the schema in the text prompt.

Generating enum values
In some cases you might want the model to choose a single option from a list of options. To implement this behavior, you can pass an enum in your schema. You can use an enum option anywhere you could use a string in the responseSchema, because an enum is an array of strings. Like a JSON schema, an enum lets you constrain model output to meet the requirements of your application.

For example, assume that you're developing an application to classify musical instruments into one of five categories: "Percussion", "String", "Woodwind", "Brass", or ""Keyboard"". You could create an enum to help with this task.

In the following example, you pass an enum as the responseSchema, constraining the model to choose the most appropriate option.

Python

from google import genai
import enum

class Instrument(enum.Enum):
PERCUSSION = "Percussion"
STRING = "String"
WOODWIND = "Woodwind"
BRASS = "Brass"
KEYBOARD = "Keyboard"

client = genai.Client(api_key="GEMINI_API_KEY")
response = client.models.generate_content(
model='gemini-2.5-flash',
contents='What type of instrument is an oboe?',
config={
'response_mime_type': 'text/x.enum',
'response_schema': Instrument,
},
)

print(response.text)

# Woodwind

The Python library will translate the type declarations for the API. However, the API accepts a subset of the OpenAPI 3.0 schema (Schema).

There are two other ways to specify an enumeration. You can use a Literal:

Python

Literal["Percussion", "String", "Woodwind", "Brass", "Keyboard"]
And you can also pass the schema as JSON:

Python

from google import genai

client = genai.Client(api_key="GEMINI_API_KEY")
response = client.models.generate_content(
model='gemini-2.5-flash',
contents='What type of instrument is an oboe?',
config={
'response_mime_type': 'text/x.enum',
'response_schema': {
"type": "STRING",
"enum": ["Percussion", "String", "Woodwind", "Brass", "Keyboard"],
},
},
)

print(response.text)

# Woodwind

Beyond basic multiple choice problems, you can use an enum anywhere in a JSON schema. For example, you could ask the model for a list of recipe titles and use a Grade enum to give each title a popularity grade:

Python

from google import genai

import enum
from pydantic import BaseModel

class Grade(enum.Enum):
A_PLUS = "a+"
A = "a"
B = "b"
C = "c"
D = "d"
F = "f"

class Recipe(BaseModel):
recipe_name: str
rating: Grade

client = genai.Client(api_key="GEMINI_API_KEY")
response = client.models.generate_content(
model='gemini-2.5-flash',
contents='List 10 home-baked cookie recipes and give them grades based on tastiness.',
config={
'response_mime_type': 'application/json',
'response_schema': list[Recipe],
},
)

print(response.text)
The response might look like this:

[
{
"recipe_name": "Chocolate Chip Cookies",
"rating": "a+"
},
{
"recipe_name": "Peanut Butter Cookies",
"rating": "a"
},
{
"recipe_name": "Oatmeal Raisin Cookies",
"rating": "b"
},
...
]
About JSON schemas
Configuring the model for JSON output using responseSchema parameter relies on Schema object to define its structure. This object represents a select subset of the OpenAPI 3.0 Schema object, and also adds a propertyOrdering field.

Tip: On Python, when you use a Pydantic model, you don't need to directly work with Schema objects, as it gets automatically converted to the corresponding JSON schema. To learn more, see JSON schemas in Python.
Here's a pseudo-JSON representation of all the Schema fields:

{
"type": enum (Type),
"format": string,
"description": string,
"nullable": boolean,
"enum": [
string
],
"maxItems": integer,
"minItems": integer,
"properties": {
string: {
object (Schema)
},
...
},
"required": [
string
],
"propertyOrdering": [
string
],
"items": {
object (Schema)
}
}
The Type of the schema must be one of the OpenAPI Data Types, or a union of those types (using anyOf). Only a subset of fields is valid for each Type. The following list maps each Type to a subset of the fields that are valid for that type:

string -> enum, format, nullable
integer -> format, minimum, maximum, enum, nullable
number -> format, minimum, maximum, enum, nullable
boolean -> nullable
array -> minItems, maxItems, items, nullable
object -> properties, required, propertyOrdering, nullable
Here are some example schemas showing valid type-and-field combinations:

{ "type": "string", "enum": ["a", "b", "c"] }

{ "type": "string", "format": "date-time" }

{ "type": "integer", "format": "int64" }

{ "type": "number", "format": "double" }

{ "type": "boolean" }

{ "type": "array", "minItems": 3, "maxItems": 3, "items": { "type": ... } }

{ "type": "object",
"properties": {
"a": { "type": ... },
"b": { "type": ... },
"c": { "type": ... }
},
"nullable": true,
"required": ["c"],
"propertyOrdering": ["c", "b", "a"]
}
For complete documentation of the Schema fields as they're used in the Gemini API, see the Schema reference.

Property ordering
Warning: When you're configuring a JSON schema, make sure to set propertyOrdering[], and when you provide examples, make sure that the property ordering in the examples matches the schema.
When you're working with JSON schemas in the Gemini API, the order of properties is important. By default, the API orders properties alphabetically and does not preserve the order in which the properties are defined (although the Google Gen AI SDKs may preserve this order). If you're providing examples to the model with a schema configured, and the property ordering of the examples is not consistent with the property ordering of the schema, the output could be rambling or unexpected.

To ensure a consistent, predictable ordering of properties, you can use the optional propertyOrdering[] field.

"propertyOrdering": ["recipeName", "ingredients"]
propertyOrdering[] – not a standard field in the OpenAPI specification – is an array of strings used to determine the order of properties in the response. By specifying the order of properties and then providing examples with properties in that same order, you can potentially improve the quality of results. propertyOrdering is only supported when you manually create types.Schema.

Schemas in Python
When you're using the Python library, the value of response_schema must be one of the following:

A type, as you would use in a type annotation (see the Python typing module)
An instance of genai.types.Schema
The dict equivalent of genai.types.Schema
The easiest way to define a schema is with a Pydantic type (as shown in the previous example):

Python

config={'response_mime_type': 'application/json',
'response_schema': list[Recipe]}
When you use a Pydantic type, the Python library builds out a JSON schema for you and sends it to the API. For additional examples, see the Python library docs.

The Python library supports schemas defined with the following types (where AllowedType is any allowed type):

int
float
bool
str
list[AllowedType]
AllowedType|AllowedType|...
For structured types:
dict[str, AllowedType]. This annotation declares all dict values to be the same type, but doesn't specify what keys should be included.
User-defined Pydantic models. This approach lets you specify the key names and define different types for the values associated with each of the keys, including nested structures.
JSON Schema support
JSON Schema is a more recent specification than OpenAPI 3.0, which the Schema object is based on. Support for JSON Schema is available as a preview using the field responseJsonSchema which accepts any JSON Schema with the following limitations:

It only works with Gemini 2.5.
While all JSON Schema properties can be passed, not all are supported. See the documentation for the field for more details.
Recursive references can only be used as the value of a non-required object property.
Recursive references are unrolled to a finite degree, based on the size of the schema.
Schemas that contain $ref cannot contain any properties other than those starting with a $.
Here's an example of generating a JSON Schema with Pydantic and submitting it to the model:

curl "https://generativelanguage.googleapis.com/v1alpha/models/\
gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY" \
 -H 'Content-Type: application/json' \
 -d @- <<EOF
{
"contents": [{
"parts":[{
"text": "Please give a random example following this schema"
}]
}],
"generationConfig": {
"response_mime_type": "application/json",
"response_json_schema": $(python3 - << PYEOF
from enum import Enum
from typing import List, Optional, Union, Set
from pydantic import BaseModel, Field, ConfigDict
import json

class UserRole(str, Enum):
ADMIN = "admin"
VIEWER = "viewer"

class Address(BaseModel):
street: str
city: str

class UserProfile(BaseModel):
username: str = Field(description="User's unique name")
age: Optional[int] = Field(ge=0, le=120)
roles: Set[UserRole] = Field(min_items=1)
contact: Union[Address, str]
model_config = ConfigDict(title="User Schema")

# Generate and print the JSON Schema

print(json.dumps(UserProfile.model_json_schema(), indent=2))
PYEOF
)
}
}
EOF
Passing JSON Schema directly is not yet supported when using the SDK.

Best practices
Keep the following considerations and best practices in mind when you're using a response schema:

The size of your response schema counts towards the input token limit.
By default, fields are optional, meaning the model can populate the fields or skip them. You can set fields as required to force the model to provide a value. If there's insufficient context in the associated input prompt, the model generates responses mainly based on the data it was trained on.
A complex schema can result in an InvalidArgument: 400 error. Complexity might come from long property names, long array length limits, enums with many values, objects with lots of optional properties, or a combination of these factors.

If you get this error with a valid schema, make one or more of the following changes to resolve the error:

Shorten property names or enum names.
Flatten nested arrays.
Reduce the number of properties with constraints, such as numbers with minimum and maximum limits.
Reduce the number of properties with complex constraints, such as properties with complex formats like date-time.
Reduce the number of optional properties.
Reduce the number of valid values for enums.
If you aren't seeing the results you expect, add more context to your input prompts or revise your response schema. For example, review the model's response without structured output to see how the model responds. You can then update your response schema so that it better fits the model's output.

What's next
Now that you've learned how to generate structured output, you might want to try using Gemini API tools:

Function calling
Code execution
Grounding with Google Search
