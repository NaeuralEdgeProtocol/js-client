import { describe, expect, test, beforeEach } from '@jest/globals';
import { rawIn } from '../../src/formatters/raw.formatter.js';

describe('Raw Formatter Tests', () => {
    let message;

    beforeEach(() => {
        message = {
            EE_EVENT_TYPE: 'HEARTBEAT',
            EE_FORMATTER: null,
            EE_HASH: 'e60c1def1ee430994858d6fafd90fc1b0593375925e786f158c02f579810ddb0',
            EE_ID: 'hydra_3',
            EE_MESSAGE_ID: 'd4509cc2-fa42-45f1-8b3a-6230ca914d1f',
            EE_MESSAGE_SEQ: 12876,
            EE_PAYLOAD_PATH: ['hydra_3', null, null, null],
            EE_SENDER: '0xai_A0cKi1g0WgloMvyc6jycdbTLThO69FMLV507dVqvB6oZ',
            EE_SIGN: 'MEUCIA-h05_Ql2xQv4vTLrEHIEBKHz2_l3DVXFPOw2NVHwUrAiEA8QtxjnkblcUVWIE24TH6GuK6cjLOtJGqkMS0pNf_fTg=',
            EE_TIMESTAMP: '2023-12-18 14:11:49.658772',
            EE_TIMEZONE: 'UTC+2',
            EE_TOTAL_MESSAGES: 12876,
            EE_TZ: 'Europe/Bucharest',
            EE_VERSION: '3.29.141',
            ENCODED_DATA:
                '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',
            HEARTBEAT_VERSION: 'v2',
            INITIATOR_ID: null,
            NR_INFERENCES: 0,
            NR_PAYLOADS: 0,
            NR_STREAMS_DATA: 0,
            SB_IMPLEMENTATION: null,
            SESSION_ID: null,
        };
    });

    test('moves properties listed in envelopeKeys to the root of the formatted object', () => {
        const result = rawIn(message);

        expect(result).toEqual({
            EE_SENDER: '0xai_A0cKi1g0WgloMvyc6jycdbTLThO69FMLV507dVqvB6oZ',
            EE_HASH: 'e60c1def1ee430994858d6fafd90fc1b0593375925e786f158c02f579810ddb0',
            EE_SIGN: 'MEUCIA-h05_Ql2xQv4vTLrEHIEBKHz2_l3DVXFPOw2NVHwUrAiEA8QtxjnkblcUVWIE24TH6GuK6cjLOtJGqkMS0pNf_fTg=',
            EE_PAYLOAD_PATH: ['hydra_3', null, null, null],
            EE_EVENT_TYPE: 'HEARTBEAT',
            EE_MESSAGE_ID: 'd4509cc2-fa42-45f1-8b3a-6230ca914d1f',
            EE_MESSAGE_SEQ: 12876,
            EE_TOTAL_MESSAGES: 12876,
            EE_TIMESTAMP: '2023-12-18 14:11:49.658772',
            EE_TIMEZONE: 'UTC+2',
            EE_TZ: 'Europe/Bucharest',
            DATA: {
                EE_FORMATTER: null,
                EE_ID: 'hydra_3',
                EE_VERSION: '3.29.141',
                ENCODED_DATA:
                    'eNrtWWtv4sgS/SstpNXMSIPT7beRrnQd0xArBjvGZCbzkEXAIb4LNgMmmWyU/75VbTM4gbxm9u5+2SgC3I/qrjrVp6ratw1nGIa8H8WR2+ONFmnIVFaaTG4ykzC1xVhLtSRdYYqmN96TBuex3W6HOHCUfl/ENh0fp2xKP0xnee/qZqz/72Y8OY+86NLXrU7PO9WoMTn9dnWo55+q+e4gHgwDjjIuRrNVUrZ2/LBnR5FobuBIGGZ7PIzi0O7VhvbD2O13OGzZ4QNop2VbYJ95vt2utQyikNu9Qdy2I7tqDc7i03IBRWJUYgquM+BgAd6G1mK5rjZzdLgxB9Ogpc1PXYeDRDsa4goNv++5fY6ze7ZzBD9jN8B2ZsiSwiSQbrB6b4/3/PAMRihMlRhTocs+tV3PPvTqnVSXFJXhRkMftBtsu6hkiA4nGMbDgdgtk1BMNxA7+nzb6Nslfv1Tt+3axGaUNgPH5U2Vdg9xM5Ef2R6KxKUsSbG2C/FKRuCiZFUxVFUvhbt90BpMXXbIlmrphmyhURy/Fwwj/vgA2/N8x454u1qTKZJm3X2FHtQgPjyLq9Vr6O7MUSUZ9e6EnFdNsiYZuHV4iod9N0KdSwW7W+PQ6jHivUCYvfYc9+yP0GZpYi/YCg7lo5gv2ZfsPy/8I4ejVToms3w0IW52kZOXTvySETJcJRMCWLbIG5hcJLO34TvyMckz/O7mswnRFGbgCPJfokiUdo/+eIMTCbGvppLowJVbpPwDX/iNvIUvRfzGDw0/ZHKvTf3xWLX9hkLelYKDZT4m82RO8qtkSYp0noBLoN9R8z35a76/krfdw3fvfligixb4TL+SN3udtq4xDCXjfJmQNUwEtalEUWP4Iq/6qGv8QzBqXZlT0SUGgtHvyKs+QLGGoIqOPfSi2Bm2kXUa4/Vk1KKN8uhiw4vxFkcWSAiOl/BhQcxMZiZTgUEspGRVUPIw2HCVpcimIhmGquuGqZqKAb1AeAPX75ekJ1sSzCZey5JMyTSI19QkVaJNpuvNaZIly3Tc/G7qsa42r9PisjmdpedjpDRcx/O7XR7GNYGllC23tN3BsTi0hgb0ot1juapPZ7pkKQp2OZF7yuPAG3aBQ0r+KTk7FlzSGOeTZDYbzUeCpd1uH9g35JueeLRapasipmJvGxaqTW2WA5qUNdNsVYyycdIomeRkCMEDWTVbz2ZisluGv3umFjFQJ9RsKbQFpM5AI10WMewjdx4Zfy9mytQQ4z17AA7h9ztu9yXLmJoudOq4IczjYeiHm2hUbVgI3NfhD6OB2+bxBz88dvvd+MgfhnV63cT6TXxxId7aUYkmrfULDeudDLbFDDzJ5eJVuP2RNDDLoGhpygiVW5TC/9YtNoMdf9iPqpUqysV9370nD5AfTeZpFi/SRTJLs2QH/h4A5sc9H2HbC385H1Gv+uugAwu8GHNZY7pqvhBzxZAMWaam9WrMZY3qsvIPYG7puvoU7FX/Pw95yNGcw0Hk98pdPou7/BB3WZXMlwNvKpqmvuKwyxa12OuBN2WVWv8A8KphGsDST2G/HbIX/h0rUOVx+BWNKb/oAQPudWLniDvHz2Ov/MqZV6ilytorzrymGkx9NfQKNcHJ/j3zjyPe5xGS/PNwq78Et0qZRl8KtylRTQFueD3cimlp5r9wPw73MIBKnZdhHSzwLOraL6FuqJr5/CGnVks2QWuJWrKlGK9H3VAY0/9i1KtriidBfzKZE73PkTqorjwN+ENGx2oaAnQQQ6GA6byorgGMwxAQPELx7Xz8e7JsTZKrZJYvRFHk99t2zPun2M2zq9YVZMBNWWJVJ1q5usgpKwTHDmJIBnxvWCkj01rVVRYTtZOB3uDa6E97aorSBG7A8TIH1Or17D6Oum1sVe1H/GMk2pbJt3UCjpdORC2VjBM2NswmHZtyU51oWvMcSrOmpZ3r4/GEnmtjEddXyfIqHSdxcbNIxAYuR0XjTlgqHDrR5nbqtnEJtUq+vCm1rNbCCdfLtEjIiKzmo9mMXCfnBEUmSxS+TFaLPFsJwclymS8bAoTa7GJ5Q0bTUZqJvdysimQOx+cix76zfE1GSyE7vyiu8WeFzDzJClKWT6OskAiOvE5h+bKNFJeiDl+SNCO4vzSbErSsRA5B3Ap+Z+N0BT+zCRbty2SM4sgih+nns0Rq3N1tzF+d+h0HVAnTWpra0iyJQkTWRKTcXHHdQ3EfgCj+XmG54ZHqseOHDm+DRw8H/J63vKiKLD39iYK0HACHEly0lFUd6egsEOP9rJ3MwTpR8r1ws8VauMTtExZhTUYJM1ua3mKaZMqKWV4wbiyyy61Pqf9cuVQWWLYjeOWY10rlsufIH0QP2wbcCSFg7xldXrBuWzeE1eaeLRJzumvQByWesM4DJfCq8EPMe0F0Frv9AMhyy43P1QXhsB9/cCNg1Ch2e3aXb6cOeL8dgx+5HSw5uC2YS9N2t7ivJNm3T7z4iHGrQeiIKCWulJ/LXvF2c2fSSyx3P0/et6HnMqndVXANvLE/dQf+j2v73aVrCdsr19X2rcvEwmhmO4xikHvIj9x+7aK+uomKI/+Yi/uoaVpcrs/jxaiIGbOPTxx+ckaP7Gy9mkyn6bWyik+WoXbyfcGucu3k2DZlQ1l0U39ynZx0jpXzi2+/ux+GF1d/fLoYto8C5diRPwXTRf7pXF8LVDYrDkMP17ssisWqdXCwHF1L5drIisB+BRCoNM7nB956Pk+AhA/s9OOiyfnB7d0BXmMezIGTD4DGpcUNCn4Y4z9/bogkAvtEJG58/bpr8N2USYzZsMypD5YWLW2INPj2YiBCzZY+8elxTsK0BXwQO8/XFxciH2t7m5tG3ZSsqqV8UVMj0nYwEKMkyxRvLTrduGwSkEbdqP4Ih3Gzt4aHWZxG8eKZau/FA+w/wB+0bBWN0DbYM7JMGjyPOxEYc8s4Hdv1UHwTN9MvNdpTxZdhCcNIzVhVVMFMIPQ90TQ4DbdOGDqnNfKou6ftoEmYQWULSwwwl2KAw+Gl7OYV2vxbUUgQVaYQQWXpEnKE5cWNVCTjyxYzq+qw2jtaSmSJW7XgMerVrzHj40M0qiSuXpHbxDO922ZIj+1/A9zjCqi6ImmKYVniSuD/qgC9t3uI/6jAEQcWOOQbWH4GA9VSJV1lOqXq36yCbNwJz4vcjuuINHzwk0iYpqpjPaJoMpOVvxsJcUAe9TNJEfETwgQwWeCKl7GfwfO/ipcHfjDApAb6St2RAeNZni/i0dU0xvdN5RoaVXUgF6qblsVkC48sMOl8Z6gsqZpmMKboqgE2sdSkSfW76qWJINFGBCOXK5LlkH5ejdLZCJJPzFlXwMqj5U1j+2q3LFka7QSTdTLLp7UJeTa7IWtItEmVWJNcZL6rRTJORzOySov1qEghEW9sDLuRxzEp/3lxd38CpN9kJw==',
                HEARTBEAT_VERSION: 'v2',
                INITIATOR_ID: null,
                NR_INFERENCES: 0,
                NR_PAYLOADS: 0,
                NR_STREAMS_DATA: 0,
                SB_IMPLEMENTATION: null,
                SESSION_ID: null,
            },
        });
    });

    test('moves properties not listed in envelopeKeys to the DATA field', () => {
        const result = rawIn(message);

        expect(result.DATA).toHaveProperty('ENCODED_DATA', message.ENCODED_DATA);
    });

    test('handles empty input correctly', () => {
        const result = rawIn({});

        expect(result).toHaveProperty('DATA', {});
    });
});
