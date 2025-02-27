import { getConfigAddresses, generateRemark, randomUpperCase, getRandomPath } from './helpers';
import { initializeParams, userID, trojanPassword, hostName, client, defaultHttpsPorts } from "../helpers/init";
import { getDataset } from '../kv/handlers';
import { renderErrorPage } from '../pages/error';

export async function getNormalConfigs(request, env) {
    await initializeParams(request, env);
    const { kvNotFound, proxySettings } = await getDataset(request, env);
    if (kvNotFound) return await renderErrorPage(request, env, 'KV Dataset is not properly set!', null, true);
    const { 
        cleanIPs, 
        proxyIP, 
        ports, 
        vlessConfigs, 
        trojanConfigs , 
        outProxy, 
        customCdnAddrs, 
        customCdnHost, 
        customCdnSni, 
        enableIPv6
    } = proxySettings;
    
    let vlessConfs = '', trojanConfs = '', chainProxy = '';
    let proxyIndex = 1;
    const Addresses = await getConfigAddresses(hostName, cleanIPs, enableIPv6);
    const customCdnAddresses = customCdnAddrs ? customCdnAddrs.split(',') : [];
    const totalAddresses = [...Addresses, ...customCdnAddresses];
    const alpn = client === 'singbox' ? 'http/1.1' : 'h2,http/1.1';
    const trojanPass = encodeURIComponent(trojanPassword);
    const earlyData = client === 'singbox' 
        ? '&eh=Sec-WebSocket-Protocol&ed=2560' 
        : encodeURIComponent('?ed=2560');
    
    ports.forEach(port => {
        totalAddresses.forEach((addr, index) => {
            const isCustomAddr = index > Addresses.length - 1;
            const configType = isCustomAddr ? 'C' : '';
            const sni = isCustomAddr ? customCdnSni : randomUpperCase(hostName);
            const host = isCustomAddr ? customCdnHost : hostName;
            const path = `${getRandomPath(16)}${proxyIP ? `/${encodeURIComponent(btoa(proxyIP))}` : ''}${earlyData}`;
            const vlessRemark = encodeURIComponent(generateRemark(proxyIndex, port, addr, cleanIPs, 'VLESS', configType));
            const trojanRemark = encodeURIComponent(generateRemark(proxyIndex, port, addr, cleanIPs, 'Trojan', configType));
            const tlsFields = defaultHttpsPorts.includes(port) 
                ? `&security=tls&sni=${sni}&fp=randomized&alpn=${alpn}`
                : '&security=none';

            if (vlessConfigs) {
                vlessConfs += `${atob('dmxlc3M')}://${userID}@${addr}:${port}?path=/${path}&encryption=none&host=${host}&type=ws${tlsFields}#${vlessRemark}\n`; 
            }

            if (trojanConfigs) {
                trojanConfs += `${atob('dHJvamFu')}://${trojanPass}@${addr}:${port}?path=/tr${path}&host=${host}&type=ws${tlsFields}#${trojanRemark}\n`;
            }
            
            proxyIndex++;
        });
    });

    if (outProxy) {
        let chainRemark = `#${encodeURIComponent('💦 Chain proxy 🔗')}`;
        if (outProxy.startsWith('socks') || outProxy.startsWith('http')) {
            const regex = /^(?:socks|http):\/\/([^@]+)@/;
            const isUserPass = outProxy.match(regex);
            const userPass = isUserPass ? isUserPass[1] : false;
            chainProxy = userPass 
                ? outProxy.replace(userPass, btoa(userPass)) + chainRemark 
                : outProxy + chainRemark;
        } else {
            chainProxy = outProxy.split('#')[0] + chainRemark;
        }
    }

    const configs = btoa(vlessConfs + trojanConfs + chainProxy);
    return new Response(configs, { 
        status: 200,
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'CDN-Cache-Control': 'no-store'
        }
    });
}