import { Linking } from 'react-native';

// Função simulada extraída da lógica do componente para teste
function formatWhatsAppUrl(phone: string, identifier: string, code: string) {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = `Olá, seu código de confirmação para a coleta eControle (${identifier}) é: *${code}*`;
    return `whatsapp://send?phone=55${cleanPhone}&text=${encodeURIComponent(message)}`;
}

describe('WhatsApp Validation Logic', () => {
    it('should format the WhatsApp URL correctly with clean phone numbers', () => {
        const phone = "(11) 98765-4321";
        const identifier = "OS-12345";
        const code = "998877";
        
        const url = formatWhatsAppUrl(phone, identifier, code);
        
        expect(url).toContain("phone=5511987654321");
        expect(url).toContain(encodeURIComponent("OS-12345"));
        expect(url).toContain(encodeURIComponent("*998877*"));
    });

    it('should handle phone numbers that are already clean', () => {
        const phone = "11999999999";
        const url = formatWhatsAppUrl(phone, "ID", "123");
        expect(url).toContain("phone=5511999999999");
    });

    it('should correctly format the user provided number (62 98164-7067)', () => {
        const phone = "62981647067";
        const identifier = "OS-PREMIUM";
        const code = "ABC-123";
        
        const url = formatWhatsAppUrl(phone, identifier, code);
        
        // Verifica se o link final está exatamente como o WhatsApp espera
        expect(url).toBe("whatsapp://send?phone=5562981647067&text=Ol%C3%A1%2C%20seu%20c%C3%B3digo%20de%20confirma%C3%A7%C3%A3o%20para%20a%20coleta%20eControle%20(OS-PREMIUM)%20%C3%A9%3A%20*ABC-123*");
        console.log("\n🚀 URL Gerada para o seu teste:\n", url);
    });
});
