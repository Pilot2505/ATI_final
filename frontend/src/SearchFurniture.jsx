import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { 
  Button, Typography, Row, Col, Card, Spin, 
  Image, Divider, Pagination, Tag, Empty, Badge 
} from 'antd';
import { 
  SearchOutlined, ShoppingCartOutlined, 
  GlobalOutlined, TagOutlined 
} from '@ant-design/icons';
import { toast } from 'react-toastify';
import ImageUpload from './components/ImageUpload'; 

const { Title, Text, Paragraph } = Typography;

const SearchFurniture = ({ isDarkMode }) => {
    // --- STATE ---
    const [uploadedImage, setUploadedImage] = useState(null); 
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState(null);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10; // Yêu cầu: 10 sản phẩm mỗi trang

    // --- THEME COLORS ---
    const theme = {
        text: isDarkMode ? "#e4e4e4" : "#2c3e50",
        subText: isDarkMode ? "#a1a1aa" : "#7f8c8d",
        bg: isDarkMode ? "#141414" : "#f8f9fa", // Màu nền tổng thể nhẹ nhàng hơn
        cardBg: isDarkMode ? "#1f1f1f" : "#ffffff",
        accent: "#1890ff",
        shadow: isDarkMode ? "0 4px 12px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.05)",
    };

    // --- HANDLERS ---
    const handleImageChange = (file, url) => {
        setUploadedImage(file);
        setUploadedImageUrl(url); 
        setSearchResults(null);
        setCurrentPage(1); // Reset về trang 1 khi chọn ảnh mới
    };

    const handleSearch = async () => {
        if (!uploadedImage) {
            toast.error("Vui lòng tải lên ảnh vật phẩm hoặc phòng để phân tích.");
            return;
        }

        setLoading(true);
        setSearchResults(null);
        setCurrentPage(1);
        
        const formData = new FormData();
        formData.append("uploaded_image", uploadedImage);

        try {
            const response = await axios.post("http://127.0.0.1:8000/api/analyze-and-search", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setSearchResults(response.data);
            toast.success("Tìm kiếm hoàn tất!");
        } catch (error) {
            console.error("Lỗi:", error);
            toast.error("Có lỗi xảy ra, vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
        // Cuộn nhẹ lên đầu danh sách sản phẩm khi chuyển trang
        const element = document.getElementById('results-anchor');
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // --- LOGIC PHÂN TRANG ---
    // Tính toán danh sách sản phẩm cho trang hiện tại
    const currentData = useMemo(() => {
        if (!searchResults || !searchResults.product_links) return [];
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return searchResults.product_links.slice(start, end);
    }, [searchResults, currentPage]);

    const totalProducts = searchResults?.product_links?.length || 0;

    // --- RENDER COMPONENTS ---

    // 1. Hiển thị các từ khóa AI đã dùng
    const renderKeywords = () => {
        if (!searchResults?.generated_queries) return null;
        return (
            <div style={{ marginTop: 16 }}>
                <Text strong style={{ color: theme.text, display: 'block', marginBottom: 8 }}>
                    <TagOutlined /> AI đã tìm kiếm:
                </Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {searchResults.generated_queries.map((item, index) => (
                        <Tag key={index} color={isDarkMode ? "geekblue" : "blue"} style={{ margin: 0 }}>
                            {item.item_name || item.name}
                        </Tag>
                    ))}
                </div>
            </div>
        );
    };

    // 2. Render danh sách sản phẩm dạng Grid (Lưới)
    const renderProductGrid = () => {
        if (currentData.length === 0) return <Empty description="Không tìm thấy sản phẩm nào" />;

        return (
            <Row gutter={[24, 24]} id="results-anchor">
                {currentData.map((product, index) => (
                    <Col xs={24} sm={12} md={12} lg={12} xl={6} key={index}>
                        <Badge.Ribbon 
                            text={product.item_name} 
                            color="cyan"
                            style={{ fontSize: 12, top: 10 }}
                        >
                            <Card
                                hoverable
                                style={{ 
                                    height: '100%', 
                                    background: theme.cardBg, 
                                    borderColor: isDarkMode ? '#303030' : '#f0f0f0',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                                styles={{body: {padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}}
                                cover={
                                    <div style={{ 
                                        height: 200, 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        alignItems: 'center',
                                        background: isDarkMode ? '#1a1a1a' : '#fff',
                                        padding: 10
                                    }}>
                                        <img 
                                            alt={product.title} 
                                            src={product.thumbnail} 
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                        />
                                    </div>
                                }
                            >
                                <div style={{ flex: 1 }}>
                                    <Text 
                                        strong 
                                        style={{ 
                                            color: theme.text, 
                                            fontSize: '1rem',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            marginBottom: 8,
                                            minHeight: 44
                                        }}
                                        title={product.title}
                                    >
                                        {product.title}
                                    </Text>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {product.price}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: '0.8rem' }}>
                                            <GlobalOutlined /> {product.source}
                                        </Text>
                                    </div>
                                </div>

                                <Button 
                                    type="primary" 
                                    block 
                                    icon={<ShoppingCartOutlined />}
                                    href={product.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ 
                                        marginTop: 'auto', 
                                        borderRadius: 6, 
                                        fontWeight: 500 
                                    }}
                                >
                                    Xem chi tiết
                                </Button>
                            </Card>
                        </Badge.Ribbon>
                    </Col>
                ))}
            </Row>
        );
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', padding: '40px 20px' }}>
            
            {/* --- HEADER --- */}
            <div style={{ textAlign: 'center', marginBottom: 50 }}>
                <Title level={2} style={{ color: theme.text, fontWeight: 300, letterSpacing: 1 }}>
                    AI Furniture Finder
                </Title>
                <Text style={{ color: theme.subText }}>
                    Tải lên ảnh phòng của bạn, chúng tôi sẽ tìm nội thất tương tự
                </Text>
            </div>

            <Row gutter={[40, 40]} justify="center">
                
                {/* --- LEFT COLUMN: INPUT & ANALYSIS --- */}
                <Col xs={24} lg={8} xl={6}>
                    <div style={{ position: 'sticky', top: 20 }}>
                        <Card 
                            style={{ 
                                background: theme.cardBg, 
                                borderRadius: 16, 
                                boxShadow: theme.shadow, 
                                border: 'none' 
                            }}
                        >
                            {!uploadedImageUrl ? (
                                <ImageUpload
                                    label="Chọn ảnh từ máy của bạn"
                                    onImageChange={handleImageChange}
                                    isDarkMode={isDarkMode}
                                />
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, marginBottom: 16 }}>
                                        <Image
                                            src={uploadedImageUrl}
                                            alt="Uploaded Room"
                                            width="100%"
                                            style={{ objectFit: 'cover' }}
                                        />
                                    </div>
                                    
                                    <Button 
                                        onClick={() => { setUploadedImage(null); setUploadedImageUrl(null); setSearchResults(null); }}
                                        type="text" danger
                                        size="small"
                                    >
                                        Chọn ảnh khác
                                    </Button>
                                </div>
                            )}

                            <Button
                                type="primary"
                                size="large"
                                icon={<SearchOutlined />}
                                loading={loading}
                                onClick={handleSearch}
                                disabled={!uploadedImage}
                                style={{ 
                                    width: '100%', 
                                    marginTop: 20, 
                                    height: 48, 
                                    borderRadius: 8,
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    boxShadow: '0 4px 14px 0 rgba(24, 144, 255, 0.39)'
                                }}
                            >
                                {loading ? "Đang phân tích..." : "Tìm kiếm Nội thất"}
                            </Button>

                            {searchResults && (
                                <>
                                    <Divider style={{ margin: '24px 0' }} />
                                    <Text strong style={{ color: theme.text }}>Mô tả phong cách:</Text>
                                    <Paragraph 
                                        style={{ color: theme.subText, marginTop: 8, fontSize: '0.95rem', fontStyle: 'italic' }}
                                        ellipsis={{ rows: 3, expandable: true, symbol: 'xem thêm' }}
                                    >
                                        "{searchResults.description}"
                                    </Paragraph>
                                    {renderKeywords()}
                                </>
                            )}
                        </Card>
                    </div>
                </Col>

                {/* --- RIGHT COLUMN: RESULTS --- */}
                <Col xs={24} lg={16} xl={17}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '100px 0' }}>
                            <Spin size="large" tip="AI đang quét các sàn thương mại..." />
                        </div>
                    ) : (
                        searchResults ? (
                            <div style={{ minHeight: 500 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <Title level={4} style={{ color: theme.text, margin: 0 }}>
                                        Kết quả tìm kiếm ({totalProducts})
                                    </Title>
                                </div>

                                {renderProductGrid()}

                                {/* --- PAGINATION --- */}
                                {totalProducts > pageSize && (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
                                        <Pagination
                                            current={currentPage}
                                            total={totalProducts}
                                            pageSize={pageSize}
                                            onChange={handlePageChange}
                                            showSizeChanger={false}
                                            theme={isDarkMode ? 'dark' : 'light'}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Empty State (Màn hình chờ)
                            <div style={{ 
                                height: '100%', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                color: theme.subText,
                                flexDirection: 'column',
                                opacity: 0.6,
                                minHeight: 400
                            }}>
                                <SearchOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                                <Text style={{ fontSize: 16, color: 'inherit' }}>Kết quả tìm kiếm sẽ hiển thị ở đây</Text>
                            </div>
                        )
                    )}
                </Col>
            </Row>
        </div>
    );
};

export default SearchFurniture;