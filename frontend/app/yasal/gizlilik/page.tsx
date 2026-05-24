export const metadata = { title: 'Gizlilik Sözleşmesi - TrendAnaliz' };

export default function GizlilikPage() {
  return (
    <>
      <h1>Gizlilik Sözleşmesi</h1>
      <p>Son güncelleme: 2026</p>

      <h2>1. Toplanan Bilgiler</h2>
      <p>
        TrendAnaliz, hizmetlerini sunabilmek için kayıt aşamasında ad, e-posta, telefon ve
        Trendyol mağaza bilgilerinizi (Supplier ID, API Key, API Secret) toplar. API anahtarları
        veritabanında AES-256-GCM ile şifrelenmiş olarak saklanır.
      </p>

      <h2>2. Çerezler (Cookies)</h2>
      <p>
        Oturum yönetimi ve kullanıcı deneyimini iyileştirmek için yalnızca zorunlu çerezler
        kullanılır. Üçüncü taraf izleme çerezi kullanılmaz.
      </p>

      <h2>3. Veri Güvenliği</h2>
      <ul>
        <li>HTTPS/TLS üzerinden şifreli iletişim</li>
        <li>JWT tabanlı oturum yönetimi ve 15 dakikalık erişim token süresi</li>
        <li>5 başarısız giriş denemesinden sonra 15 dakikalık hesap kilidi</li>
        <li>Şifreler bcrypt ile salt eklenerek hash&apos;lenir</li>
        <li>Trendyol API kimlik bilgileri AES-256 ile şifrelenir</li>
      </ul>

      <h2>4. Üçüncü Taraf Hizmetler</h2>
      <p>
        Ödeme işlemleri Iyzico altyapısı üzerinden gerçekleştirilir. Kart bilgileriniz
        sunucularımızda tutulmaz. Trendyol API entegrasyonu için Trendyol&apos;un resmi satıcı
        API&apos;si kullanılır.
      </p>

      <h2>5. Veri Saklama Süresi</h2>
      <p>
        Hesabınız aktif olduğu sürece veriler tutulur. Hesap iptali sonrası yasal yükümlülükler
        kapsamında en fazla 10 yıl boyunca anonimleştirilerek saklanır.
      </p>

      <h2>6. İletişim</h2>
      <p>
        Sorularınız için <a href="mailto:destek@trendanaliz.com">destek@trendanaliz.com</a>
        adresine ulaşabilirsiniz.
      </p>
    </>
  );
}
