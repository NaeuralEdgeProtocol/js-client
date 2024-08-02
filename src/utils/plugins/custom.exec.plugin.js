export const CUSTOM_EXEC_01_SIGNATURE = 'CUSTOM_EXEC_01';

export const pluginDefinition = {
    schema: {
        name: 'Custom code executor',
        description: 'This plugin is able to run custom code on the naeural edge node.',
        type: CUSTOM_EXEC_01_SIGNATURE,
        fields: [
            {
                key: 'CODE',
                type: 'string',
                label: 'Custom code',
                description: 'The code to be run on the remote naeural edge node.',
                default: null,
                required: true,
            },
            {
                key: 'PROCESS_DELAY',
                type: 'float',
                label: 'Sample Delay',
                description: 'Timespan between each iteration of the process.',
                default: 10,
                required: true,
                allowedValues: null,
            },
        ],
        options: {
            linkable: false,
        },
    },
};
