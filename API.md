## Classes

<dl>
<dt><a href="#Logger">Logger</a></dt>
<dd><p>Logger</p>
<p>This is a minimalistic implementation of a logger to be used if no other logger is provided.</p>
</dd>
<dt><a href="#ZxAIClient">ZxAIClient</a> ⇐ <code>EventEmitter2</code></dt>
<dd></dd>
<dt><a href="#InternalStateManager">InternalStateManager</a> ⇐ <code>EventEmitter2</code></dt>
<dd></dd>
<dt><a href="#NetworkRequest">NetworkRequest</a></dt>
<dd><p>NetworkRequest</p>
<p>This is the Network Request model. It handles the lifecycle of a request made for a network node and keeps track
of the responses received. Based on the notifications intercepted from the node, it attempts to resolve or reject
the promise returned upwards.</p>
</dd>
<dt><a href="#NetworkRequestsHandler">NetworkRequestsHandler</a></dt>
<dd><p>This is the manager keeping track of all the open transactions published for the network nodes.</p>
</dd>
<dt><a href="#RedisStateManager">RedisStateManager</a></dt>
<dd><p>RedisStateManager</p>
<p>This is the implementation of the state manager leveraging Redis as state storage. This is the manager to be used
when a multi-process instance of the SDK is needed.</p>
</dd>
<dt><a href="#State">State</a> ⇐ <code><a href="#InternalStateManager">InternalStateManager</a></code></dt>
<dd></dd>
<dt><a href="#ZxAIBC">ZxAIBC</a></dt>
<dd><p>ZxAIBC</p>
<p>This is the DecentrAI Network Blockchain engine. Its purpose is to offer any integrator common features like
signature checking, message validation or key pair generation.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#identityFormatter">identityFormatter</a> ⇒ <code>*</code></dt>
<dd><p>The default formatter. Does not alter the received message.</p>
</dd>
<dt><a href="#rawIn">rawIn</a> ⇒ <code>Object</code></dt>
<dd><p>Transforms <code>raw</code> messages into the default format.
TODO: add link to the internal format docs.</p>
</dd>
<dt><a href="#schema">schema</a> : <code><a href="#SchemaDefinition">SchemaDefinition</a></code></dt>
<dd><p>The MetaStream schema definition.</p>
</dd>
<dt><a href="#schema">schema</a> : <code><a href="#SchemaDefinition">SchemaDefinition</a></code></dt>
<dd><p>The VideoFile schema definition.</p>
</dd>
<dt><a href="#schema">schema</a> : <code><a href="#SchemaDefinition">SchemaDefinition</a></code></dt>
<dd><p>The VideoFile schema definition.</p>
</dd>
<dt><a href="#schema">schema</a> : <code><a href="#SchemaDefinition">SchemaDefinition</a></code></dt>
<dd><p>The VoidStream schema definition.</p>
</dd>
<dt><a href="#encode">encode</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>Helper function for zipping a string and encoding the result as base64.</p>
<p>The output can be decoded using <code>decode(string)</code>.</p>
</dd>
<dt><a href="#decode">decode</a> ⇒ <code>Promise.&lt;string&gt;</code></dt>
<dd><p>Helper function for unzipping a string that has been received as base64.</p>
<p>The reverse process can be obtained with <code>encode(code)</code>;</p>
</dd>
<dt><a href="#camelToZxAIFormat">camelToZxAIFormat</a> ⇒ <code>string</code></dt>
<dd><p>Helper function that transforms camelCase strings into DecentrAI network specific format.
Conventionally, DecentrAI commands have the keys in uppercase with underscore as word separator.</p>
<p>eg. blockchainKeyPair will be transformed as BLOCKCHAIN_KEY_PAIR</p>
</dd>
<dt><a href="#convertKeysToZxAIFormat">convertKeysToZxAIFormat</a> ⇒ <code>Object</code></dt>
<dd><p>Helper function for transforming all the keys of the provided generic object into the
conventional DecentrAI Network key format.</p>
</dd>
<dt><a href="#zxAIFormatToCamel">zxAIFormatToCamel</a> ⇒ <code>string</code></dt>
<dd><p>Helper function for transforming an DecentrAI Network conventional OBJECT_KEY into a camel case objectKey.</p>
</dd>
<dt><a href="#convertKeysToCamelFormat">convertKeysToCamelFormat</a> ⇒ <code>Object</code></dt>
<dd><p>Helper function for transforming all the keys of the provided generic object into the
conventional camelCase key format.</p>
</dd>
<dt><a href="#urlSafeBase64ToBase64">urlSafeBase64ToBase64</a> ⇒ <code>string</code></dt>
<dd><p>Helper function that reverts any replaced URL-unsafe characters in a base64 string.</p>
</dd>
<dt><a href="#base64ToUrlSafeBase64">base64ToUrlSafeBase64</a> ⇒ <code>string</code></dt>
<dd><p>Helper function that replaces any URL-unsafe characters from a base64 string.</p>
</dd>
<dt><a href="#pick">pick</a> ⇒ <code>undefined</code> | <code>Object</code></dt>
<dd><p>Helper function that extracts a sub-object from the provided object based on the provided path.
The path string will represent each selection from the nested levels, separated by dots.</p>
<p>Examples:</p>
<ul>
<li><code>name.first</code> will attempt to return the value stored under the <code>first</code> key of the nested object stored
at <code>name</code> property</li>
<li><code>contacts.2.email</code> will attempt to extract the email stored under the third index of the <code>contacts</code> array</li>
</ul>
<p> If no value can be found at the end of the path, the function returns <code>undefined</code>.</p>
</dd>
<dt><a href="#checkType">checkType</a> ⇒ <code>boolean</code></dt>
<dd><p>Helper function for checking if a value-object is of a specific type (as defined in the schema) and if it&#39;s value
complies with the allowedValues rule.</p>
</dd>
<dt><a href="#validateAgainstSchema">validateAgainstSchema</a> ⇒ <code>Array.&lt;string&gt;</code></dt>
<dd><p>Helper function that validates a generic object based on a received schema. Will return an array of all the validation
errors, if any, empty array otherwise. This function will not check if all the mandatory keys are present, it will
only test if the provided values are of the correct type and the allowedValues rule is not broken.</p>
</dd>
<dt><a href="#applyDefaultsToObject">applyDefaultsToObject</a> ⇒ <code>Object</code></dt>
<dd><p>Helper function that returns an object with all the missing mandatory properties based on a generic object provided.
The mandatory properties are compuded based on the provided schema. All the properties added are assigned the default
values from the schema definition. If no default value is provided in the schema, the property is not added to the
returned object.</p>
</dd>
<dt><a href="#checkMandatoryFields">checkMandatoryFields</a> ⇒ <code>boolean</code></dt>
<dd><p>Helper function that tests a generic object to have all the mandatory properties populated.</p>
</dd>
<dt><a href="#sleep">sleep</a> ⇒ <code>Promise.&lt;unknown&gt;</code></dt>
<dd><p>Helper function that resolves a promise after a specified amount of milliseconds.</p>
</dd>
<dt><a href="#hasFleetFilter">hasFleetFilter</a> ⇒ <code>boolean</code></dt>
<dd><p>This function returns true if the fleet definition is correct and is not the definition of the whole network.
For processing the entire network, the fleet should be configured as [ ALL_EDGE_NODES ].</p>
</dd>
<dt><a href="#IsObject">IsObject</a> ⇒ <code>boolean</code></dt>
<dd><p>Helper function that tests if a specific value is an Object.</p>
</dd>
<dt><a href="#generateId">generateId</a> ⇒ <code>string</code></dt>
<dd><p>Helper function that extracts the first two groups of characters from a v4 Uuid. This function can be used for
generating unique identification strings for threads, messages or other entities.</p>
</dd>
<dt><a href="#computeDifferences">computeDifferences</a> ⇒ <code>Object</code> | <code>null</code></dt>
<dd><p>Helper function that compares two generic objects and returns the modified keys from the second object when compared
to the first.</p>
</dd>
<dt><a href="#getRedisConnection">getRedisConnection</a> ⇒ <code>Redis</code></dt>
<dd><p>Helper function for providing Redis connection.</p>
</dd>
<dt><a href="#dctSchemas">dctSchemas</a> : <code><a href="#SchemaCollection">SchemaCollection</a></code></dt>
<dd></dd>
<dt><a href="#schemas">schemas</a> : <code><a href="#SchemasRepository">SchemasRepository</a></code></dt>
<dd></dd>
<dt><a href="#defaultSchemas">defaultSchemas</a> ⇒ <code><a href="#SchemasRepository">SchemasRepository</a></code></dt>
<dd><p>The default schemas supported by the SDK.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#archiveConfigRequestStrategy">archiveConfigRequestStrategy(notification, request)</a></dt>
<dd><p>Defines the strategy to be applied when attempting to solve an ARCHIVE_CONFIG network request.</p>
</dd>
<dt><a href="#updateConfigRequestStrategy">updateConfigRequestStrategy(notification, request)</a></dt>
<dd><p>Defines the strategy to be applied when attempting to solve an UPDATE_CONFIG network request.</p>
</dd>
<dt><a href="#updatePipelineInstanceRequestStrategy">updatePipelineInstanceRequestStrategy(notification, request)</a></dt>
<dd><p>Defines the strategy to be applied when attempting to solve an UPDATE_PIPELINE_INSTANCE or
BATCH_UPDATE_PIPELINE_INSTANCE network request.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#AlertedNodes">AlertedNodes</a> : <code>Object.&lt;string, number&gt;</code></dt>
<dd></dd>
<dt><a href="#ZxAIClientOptions">ZxAIClientOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#AvailableSchemaResponse">AvailableSchemaResponse</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#AvailableDCTResponse">AvailableDCTResponse</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ZxAICommand">ZxAICommand</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ZxAIUpdateInstanceConfig">ZxAIUpdateInstanceConfig</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ObservedNodes">ObservedNodes</a> : <code>Object.&lt;string, number&gt;</code></dt>
<dd></dd>
<dt><a href="#NodeStatus">NodeStatus</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#ZxAIBlockchainOptions">ZxAIBlockchainOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#RedisConnectionOptions">RedisConnectionOptions</a> : <code>Object</code></dt>
<dd></dd>
<dt><a href="#IntervalDefinition">IntervalDefinition</a> : <code>Object</code></dt>
<dd><p>Represents the configuration for an interval.</p>
</dd>
<dt><a href="#AllowedValues">AllowedValues</a> : <code>Array.&lt;string&gt;</code> | <code><a href="#IntervalDefinition">IntervalDefinition</a></code></dt>
<dd><p>Represents the allowed values for a field.</p>
</dd>
<dt><a href="#Field">Field</a> : <code>Object</code></dt>
<dd><p>Represents a field in the configuration.</p>
</dd>
<dt><a href="#SchemaDefinition">SchemaDefinition</a> : <code>Object</code></dt>
<dd><p>Represents the schema configuration</p>
</dd>
<dt><a href="#SchemaCollection">SchemaCollection</a> : <code>Object.&lt;string, SchemaDefinition&gt;</code></dt>
<dd><p>A dictionary object holding schema configurations</p>
</dd>
<dt><a href="#SchemasRepository">SchemasRepository</a> : <code>Object</code></dt>
<dd></dd>
</dl>

<a name="NetworkRequestsHandler"></a>

## NetworkRequestsHandler
This is the manager keeping track of all the open transactions published for the network nodes.

**Kind**: global class  

* [NetworkRequestsHandler](#NetworkRequestsHandler)
    * [.createRequest(action, onSuccess, onFail)](#NetworkRequestsHandler+createRequest) ⇒ [<code>NetworkRequest</code>](#NetworkRequest)
    * [.index(path, request)](#NetworkRequestsHandler+index) ⇒ [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)
    * [.find(path)](#NetworkRequestsHandler+find) ⇒ [<code>NetworkRequest</code>](#NetworkRequest) \| <code>null</code>
    * [.destroy(path)](#NetworkRequestsHandler+destroy) ⇒ [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)

<a name="NetworkRequestsHandler+createRequest"></a>

### networkRequestsHandler.createRequest(action, onSuccess, onFail) ⇒ [<code>NetworkRequest</code>](#NetworkRequest)
Creates a new transaction handling the message publishing for a network node.

**Kind**: instance method of [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)  

| Param | Type |
| --- | --- |
| action | <code>string</code> | 
| onSuccess | <code>function</code> | 
| onFail | <code>function</code> | 

<a name="NetworkRequestsHandler+index"></a>

### networkRequestsHandler.index(path, request) ⇒ [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)
Indexes the transaction `request` by the specified notification `path` to watch for.

**Kind**: instance method of [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)  

| Param | Type |
| --- | --- |
| path | <code>Array.&lt;string&gt;</code> | 
| request | [<code>NetworkRequest</code>](#NetworkRequest) | 

<a name="NetworkRequestsHandler+find"></a>

### networkRequestsHandler.find(path) ⇒ [<code>NetworkRequest</code>](#NetworkRequest) \| <code>null</code>
Retrieves the transaction handler watching for the supplied `path`.

**Kind**: instance method of [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)  

| Param | Type |
| --- | --- |
| path | <code>Array.&lt;string&gt;</code> | 

<a name="NetworkRequestsHandler+destroy"></a>

### networkRequestsHandler.destroy(path) ⇒ [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)
Cleans up the transaction handler related to the supplied `path`.

**Kind**: instance method of [<code>NetworkRequestsHandler</code>](#NetworkRequestsHandler)  

| Param | Type |
| --- | --- |
| path | <code>Array.&lt;string&gt;</code> | 

<a name="ZxAIEventType"></a>

## ZxAIEventType : <code>enum</code>
Enum DecentrAI Event Stream Types

**Kind**: global enum  
<a name="ZxAIClientEvent"></a>

## ZxAIClientEvent : <code>enum</code>
Enum DecentrAI Client Events

**Kind**: global enum  
<a name="identityFormatter"></a>

## identityFormatter ⇒ <code>\*</code>
The default formatter. Does not alter the received message.

**Kind**: global constant  

| Param |
| --- |
| message | 

<a name="rawIn"></a>

## rawIn ⇒ <code>Object</code>
Transforms `raw` messages into the default format.
TODO: add link to the internal format docs.

**Kind**: global constant  

| Param |
| --- |
| message | 

<a name="schema"></a>

## schema : [<code>SchemaDefinition</code>](#SchemaDefinition)
The MetaStream schema definition.

**Kind**: global constant  
<a name="schema"></a>

## schema : [<code>SchemaDefinition</code>](#SchemaDefinition)
The VideoFile schema definition.

**Kind**: global constant  
<a name="schema"></a>

## schema : [<code>SchemaDefinition</code>](#SchemaDefinition)
The VideoFile schema definition.

**Kind**: global constant  
<a name="schema"></a>

## schema : [<code>SchemaDefinition</code>](#SchemaDefinition)
The VoidStream schema definition.

**Kind**: global constant  
<a name="encode"></a>

## encode ⇒ <code>Promise.&lt;string&gt;</code>
Helper function for zipping a string and encoding the result as base64.

The output can be decoded using `decode(string)`.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| code | <code>string</code> | 

<a name="decode"></a>

## decode ⇒ <code>Promise.&lt;string&gt;</code>
Helper function for unzipping a string that has been received as base64.

The reverse process can be obtained with `encode(code)`;

**Kind**: global constant  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>string</code> | the base64 encoded and zipped information. |

<a name="camelToZxAIFormat"></a>

## camelToZxAIFormat ⇒ <code>string</code>
Helper function that transforms camelCase strings into DecentrAI network specific format.
Conventionally, DecentrAI commands have the keys in uppercase with underscore as word separator.

eg. blockchainKeyPair will be transformed as BLOCKCHAIN_KEY_PAIR

**Kind**: global constant  

| Param | Type |
| --- | --- |
| input | <code>string</code> | 

<a name="convertKeysToZxAIFormat"></a>

## convertKeysToZxAIFormat ⇒ <code>Object</code>
Helper function for transforming all the keys of the provided generic object into the
conventional DecentrAI Network key format.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| obj | <code>Object</code> | 

<a name="zxAIFormatToCamel"></a>

## zxAIFormatToCamel ⇒ <code>string</code>
Helper function for transforming an DecentrAI Network conventional OBJECT_KEY into a camel case objectKey.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| key | <code>string</code> | 

<a name="convertKeysToCamelFormat"></a>

## convertKeysToCamelFormat ⇒ <code>Object</code>
Helper function for transforming all the keys of the provided generic object into the
conventional camelCase key format.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| obj | <code>Object</code> | 

<a name="urlSafeBase64ToBase64"></a>

## urlSafeBase64ToBase64 ⇒ <code>string</code>
Helper function that reverts any replaced URL-unsafe characters in a base64 string.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| urlSafeBase64 | <code>string</code> | 

<a name="base64ToUrlSafeBase64"></a>

## base64ToUrlSafeBase64 ⇒ <code>string</code>
Helper function that replaces any URL-unsafe characters from a base64 string.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| base64 | <code>string</code> | 

<a name="pick"></a>

## pick ⇒ <code>undefined</code> \| <code>Object</code>
Helper function that extracts a sub-object from the provided object based on the provided path.
The path string will represent each selection from the nested levels, separated by dots.

Examples:
 - `name.first` will attempt to return the value stored under the `first` key of the nested object stored
at `name` property
 - `contacts.2.email` will attempt to extract the email stored under the third index of the `contacts` array

 If no value can be found at the end of the path, the function returns `undefined`.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| path | <code>string</code> | 
| obj | <code>Object</code> | 

<a name="checkType"></a>

## checkType ⇒ <code>boolean</code>
Helper function for checking if a value-object is of a specific type (as defined in the schema) and if it's value
complies with the allowedValues rule.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| value | <code>Object</code> | 
| type | <code>string</code> | 
| allowedValues | [<code>AllowedValues</code>](#AllowedValues) | 

<a name="validateAgainstSchema"></a>

## validateAgainstSchema ⇒ <code>Array.&lt;string&gt;</code>
Helper function that validates a generic object based on a received schema. Will return an array of all the validation
errors, if any, empty array otherwise. This function will not check if all the mandatory keys are present, it will
only test if the provided values are of the correct type and the allowedValues rule is not broken.

**Kind**: global constant  
**Returns**: <code>Array.&lt;string&gt;</code> - The validation errors.  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>Object</code> | The object to test against the schema |
| schema | [<code>SchemaDefinition</code>](#SchemaDefinition) \| <code>null</code> | The schema. |

<a name="applyDefaultsToObject"></a>

## applyDefaultsToObject ⇒ <code>Object</code>
Helper function that returns an object with all the missing mandatory properties based on a generic object provided.
The mandatory properties are compuded based on the provided schema. All the properties added are assigned the default
values from the schema definition. If no default value is provided in the schema, the property is not added to the
returned object.

**Kind**: global constant  
**Returns**: <code>Object</code> - A new object with all the missing properties.  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>Object</code> | The generic object. |
| schema | [<code>SchemaDefinition</code>](#SchemaDefinition) \| <code>null</code> | The schema. |
| addOptionals | <code>boolean</code> |  |

<a name="checkMandatoryFields"></a>

## checkMandatoryFields ⇒ <code>boolean</code>
Helper function that tests a generic object to have all the mandatory properties populated.

**Kind**: global constant  
**Returns**: <code>boolean</code> - `true` if all the mandatory properties have values.  

| Param | Type | Description |
| --- | --- | --- |
| obj | <code>Object</code> | The generic object. |
| schema | [<code>SchemaDefinition</code>](#SchemaDefinition) \| <code>null</code> | The schema. |

<a name="sleep"></a>

## sleep ⇒ <code>Promise.&lt;unknown&gt;</code>
Helper function that resolves a promise after a specified amount of milliseconds.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| timeout | <code>number</code> | 

<a name="hasFleetFilter"></a>

## hasFleetFilter ⇒ <code>boolean</code>
This function returns true if the fleet definition is correct and is not the definition of the whole network.
For processing the entire network, the fleet should be configured as [ ALL_EDGE_NODES ].

**Kind**: global constant  

| Param | Type | Description |
| --- | --- | --- |
| fleet | <code>Array.&lt;string&gt;</code> | a fleet definition |

<a name="IsObject"></a>

## IsObject ⇒ <code>boolean</code>
Helper function that tests if a specific value is an Object.

**Kind**: global constant  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>\*</code> | the value to test |

<a name="generateId"></a>

## generateId ⇒ <code>string</code>
Helper function that extracts the first two groups of characters from a v4 Uuid. This function can be used for
generating unique identification strings for threads, messages or other entities.

**Kind**: global constant  
<a name="computeDifferences"></a>

## computeDifferences ⇒ <code>Object</code> \| <code>null</code>
Helper function that compares two generic objects and returns the modified keys from the second object when compared
to the first.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| original | <code>Object</code> | 
| modified | <code>Object</code> | 

<a name="getRedisConnection"></a>

## getRedisConnection ⇒ <code>Redis</code>
Helper function for providing Redis connection.

**Kind**: global constant  

| Param | Type |
| --- | --- |
| connectionOptions | [<code>RedisConnectionOptions</code>](#RedisConnectionOptions) | 

<a name="dctSchemas"></a>

## dctSchemas : [<code>SchemaCollection</code>](#SchemaCollection)
**Kind**: global constant  
<a name="schemas"></a>

## schemas : [<code>SchemasRepository</code>](#SchemasRepository)
**Kind**: global constant  
<a name="defaultSchemas"></a>

## defaultSchemas ⇒ [<code>SchemasRepository</code>](#SchemasRepository)
The default schemas supported by the SDK.

**Kind**: global constant  
<a name="archiveConfigRequestStrategy"></a>

## archiveConfigRequestStrategy(notification, request)
Defines the strategy to be applied when attempting to solve an ARCHIVE_CONFIG network request.

**Kind**: global function  

| Param | Type |
| --- | --- |
| notification | <code>Object</code> | 
| request | [<code>NetworkRequest</code>](#NetworkRequest) | 

<a name="updateConfigRequestStrategy"></a>

## updateConfigRequestStrategy(notification, request)
Defines the strategy to be applied when attempting to solve an UPDATE_CONFIG network request.

**Kind**: global function  

| Param | Type |
| --- | --- |
| notification | <code>Object</code> | 
| request | [<code>NetworkRequest</code>](#NetworkRequest) | 

<a name="updatePipelineInstanceRequestStrategy"></a>

## updatePipelineInstanceRequestStrategy(notification, request)
Defines the strategy to be applied when attempting to solve an UPDATE_PIPELINE_INSTANCE or
BATCH_UPDATE_PIPELINE_INSTANCE network request.

**Kind**: global function  

| Param | Type |
| --- | --- |
| notification | <code>Object</code> | 
| request | [<code>NetworkRequest</code>](#NetworkRequest) | 

<a name="AlertedNodes"></a>

## AlertedNodes : <code>Object.&lt;string, number&gt;</code>
**Kind**: global typedef  
<a name="ZxAIClientOptions"></a>

## ZxAIClientOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| emitterOptions | <code>any</code> | the EventEmitter2 setup |
| initiator | <code>any</code> | The initiator of the configuration. |
| blockchain | <code>Object</code> | Blockchain related configurations. |
| blockchain.debug | <code>boolean</code> | Indicates if blockchain debugging is enabled. |
| blockchain.key | <code>string</code> | The blockchain key. |
| stateManager | <code>string</code> | Describes the state manager. |
| loglevel | <code>string</code> | Describes the state manager. |
| redis | <code>Object</code> | Redis configuration details. |
| redis.host | <code>string</code> | The Redis server host. |
| redis.port | <code>number</code> | The Redis server port. |
| redis.password | <code>any</code> | The Redis password. |
| redis.pubSubChannel | <code>string</code> | The Redis Pub/Sub channel name. |
| mqttOptions | <code>Object</code> | MQTT connection options. |
| mqttOptions.url | <code>any</code> | The MQTT server URL. |
| mqttOptions.username | <code>any</code> | The MQTT username for authentication. |
| mqttOptions.password | <code>any</code> | The MQTT password for authentication. |
| customFormatters | <code>Object</code> | Custom formatters for configuration. |
| threads | <code>Object</code> | Thread configuration for various tasks. |
| threads.heartbeats | <code>number</code> | The number of heartbeat threads. |
| threads.notifications | <code>number</code> | The number of notification threads. |
| threads.payloads | <code>number</code> | The number of payload processing threads. |
| fleet | <code>Array.&lt;string&gt;</code> | An array of fleet strings. |

<a name="AvailableSchemaResponse"></a>

## AvailableSchemaResponse : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| signature | <code>string</code> | The unique signature. |
| linkable | <code>boolean</code> | Indicates if the entity is linkable. |
| name | <code>string</code> | The name of the entity. |
| description | <code>string</code> | A description of the entity. |

<a name="AvailableDCTResponse"></a>

## AvailableDCTResponse : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | The name of the entity. |
| description | <code>string</code> | A description of the entity. |
| type | <code>string</code> | The unique signature. |

<a name="ZxAICommand"></a>

## ZxAICommand : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ACTION | <code>string</code> | The action to be performed on the network node |
| PAYLOAD | <code>Object</code> \| <code>string</code> | The payload for the forementioned `ACTION` |
| [EE_ID] | <code>string</code> | The node identificator to route the command to, is optional up until the actual publishing. |
| [EE_SENDER] | <code>string</code> | The identity of the sender, is optional up until publishing |
| [EE_HASH] | <code>string</code> | The sha256 hash of the `ACTION` and `PAYLOAD` |
| [EE_SIGN] | <code>string</code> | The signature of the `EE_HASH` using the `EE_SENDER`'s identity |
| [INITIATOR_ID] | <code>string</code> | Optional until publishing, the human-readable identity of the sender. |
| [SESSION_ID] | <code>string</code> | Optional, the session ID to be used when performing the action. |

<a name="ZxAIUpdateInstanceConfig"></a>

## ZxAIUpdateInstanceConfig : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| NAME | <code>string</code> | The pipeline id |
| SIGNATURE | <code>string</code> | The instance signature |
| INSTANCE_ID | <code>string</code> | The instance id |
| INSTANCE_CONFIG | <code>Object</code> | The new configuration to be applied for the instance |

<a name="ObservedNodes"></a>

## ObservedNodes : <code>Object.&lt;string, number&gt;</code>
**Kind**: global typedef  
<a name="NodeStatus"></a>

## NodeStatus : <code>Object</code>
**Kind**: global typedef  
<a name="ZxAIBlockchainOptions"></a>

## ZxAIBlockchainOptions : <code>Object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [debug] | <code>boolean</code> | Indicates if debugging is enabled. |
| [key] | <code>string</code> | The key for the blockchain. |
| [encrypt] | <code>boolean</code> | Indicates if encryption is enabled. |
| [secure] | <code>boolean</code> | Indicates if the connection should be secure. |

<a name="RedisConnectionOptions"></a>

## RedisConnectionOptions : <code>Object</code>
**Kind**: global typedef  
<a name="IntervalDefinition"></a>

## IntervalDefinition : <code>Object</code>
Represents the configuration for an interval.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [min] | <code>number</code> | The minimum value for the interval |
| [max] | <code>number</code> | The maximum value for the interval |

<a name="AllowedValues"></a>

## AllowedValues : <code>Array.&lt;string&gt;</code> \| [<code>IntervalDefinition</code>](#IntervalDefinition)
Represents the allowed values for a field.

**Kind**: global typedef  
<a name="Field"></a>

## Field : <code>Object</code>
Represents a field in the configuration.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key identifier for the field. |
| type | <code>string</code> | The type of the field (e.g., 'integer'). |
| label | <code>string</code> | The human-readable label for the field. |
| description | <code>string</code> | The description of the field. |
| default | <code>\*</code> | The default value for the field. |
| required | <code>boolean</code> | Whether the field is required. |
| [allowedValues] | [<code>AllowedValues</code>](#AllowedValues) | The allowed values for the field. |

<a name="SchemaDefinition"></a>

## SchemaDefinition : <code>Object</code>
Represents the schema configuration

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [options] | <code>\*</code> | Optional property describing other options. |
| name | <code>string</code> | The name of the DCT. |
| description | <code>string</code> | The description of the DCT. |
| type | <code>string</code> | The type of the DCT, indicating the specific DCT type. |
| fields | [<code>Array.&lt;Field&gt;</code>](#Field) | An array of fields for the DCT configuration. |

<a name="SchemaCollection"></a>

## SchemaCollection : <code>Object.&lt;string, SchemaDefinition&gt;</code>
A dictionary object holding schema configurations

**Kind**: global typedef  
<a name="SchemasRepository"></a>

## SchemasRepository : <code>Object</code>
**Kind**: global typedef  
